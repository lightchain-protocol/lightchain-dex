import useCurrentChain from "./useCurrentChain";
import { Token } from "../types/Token";
import { useAccount } from "wagmi";
import {
  getContract,
  parseUnits,
  formatUnits,
  zeroAddress,
  Signature,
  erc20Abi,
  parseSignature,
  ContractFunctionName,
} from "viem";
import useWeb3Clients from "./useWeb3Clients";
import useContracts from "./useContracts";
import { Pair } from "@/types/Pair";
import pairAbi from "@/contracts/pairAbi";
import useUserStore from "@/store/user-store";
import { MAX_UINT256 } from "@/lib/utils";
import {
  applySlippage,
  applySlippageToRatio,
  deadlineFrom,
} from "@/lib/slippage";
import config from "@/config";
import { toast } from "sonner";
import { useMemo } from "react";
import { estimateContractGas, simulateContract } from "viem/actions";
import wethAbi from "@/contracts/wethAbi";

const useWeb3Functions = () => {
  const chain = useCurrentChain();
  const { address } = useAccount();
  const { publicClient, walletClient } = useWeb3Clients();
  const { routerV2Contract } = useContracts();
  const { slippageTolerance, txDeadline } = useUserStore();

  const weth = useMemo(() => config.WETH[chain.id], [chain.id]);
  const nativeCurrencySymbol = chain.nativeCurrency.symbol;

  const isNativeToken = (token: Token) =>
    !token.address || token.symbol === nativeCurrencySymbol;

  const isWrappedNativeToken = (token: Token) =>
    !!token.address && token.address.toLowerCase() === weth.toLowerCase();

  const isNativeWrappedPair = (tokenA: Token, tokenB: Token) =>
    (isNativeToken(tokenA) && isWrappedNativeToken(tokenB)) ||
    (isWrappedNativeToken(tokenA) && isNativeToken(tokenB));

  const getAmountFromTo = async (
    amount: string,
    tokenFrom: Token,
    tokenTo: Token
  ) => {
    if (!tokenFrom || !tokenTo) return 0;
    if (isNativeWrappedPair(tokenFrom, tokenTo)) return amount;

    try {
      const tokenAmount = await routerV2Contract.read
        .getAmountsOut([
          parseUnits(amount, tokenFrom.decimals),
          [tokenFrom.address || weth, tokenTo.address || weth],
        ])
        .catch(() => [0n, 0n]);

      return formatUnits(tokenAmount[tokenAmount.length - 1], tokenTo.decimals);
    } catch (e) {
      console.log(e);
    }
  };

  const checkAllowance = async (token: Token, amount: bigint) => {
    if (!address || !walletClient || !token.address) return;

    const tokenContract = getContract({
      abi: erc20Abi,
      address: token.address,
      client: {
        public: publicClient,
        wallet: walletClient,
      },
    });
    const allowance = await tokenContract.read.allowance([
      address,
      routerV2Contract.address,
    ]);

    if (allowance < amount) {
      const hash = await tokenContract.write.approve(
        [routerV2Contract.address, MAX_UINT256],
        { account: address }
      );

      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`${token.symbol} spend approved successfully`);
    }
  };

  const swap = async (
    valueFrom: string,
    valueTo: string,
    tokenFrom: Token,
    tokenTo: Token
  ) => {
    if (!address || !walletClient) return;

    try {
      const amount = parseUnits(valueFrom, tokenFrom.decimals);

      if (isNativeWrappedPair(tokenFrom, tokenTo)) {
        let hash: `0x${string}`;

        if (isNativeToken(tokenFrom)) {
          const { request } = await publicClient.simulateContract({
            abi: wethAbi,
            address: weth,
            functionName: "deposit",
            account: address,
            value: amount,
          });
          hash = await walletClient.writeContract(request);
        } else {
          const { request } = await publicClient.simulateContract({
            abi: wethAbi,
            address: weth,
            functionName: "withdraw",
            args: [amount],
            account: address,
          });
          hash = await walletClient.writeContract(request);
        }

        return hash;
      }

      const block = await publicClient.getBlock();
      const deadline = deadlineFrom(block.timestamp, txDeadline);
      const amountOutMin = applySlippage(
        parseUnits(valueTo, tokenTo.decimals),
        slippageTolerance
      );

      const fromAddress =
        !tokenFrom.address || tokenFrom.symbol === chain.nativeCurrency.symbol
          ? zeroAddress
          : tokenFrom.address;
      const toAddress =
        !tokenTo.address || tokenTo.symbol === chain.nativeCurrency.symbol
          ? zeroAddress
          : tokenTo.address;

      if (tokenFrom.symbol !== chain.nativeCurrency.symbol) {
        await checkAllowance(tokenFrom, amount);
      }

      let methods: ContractFunctionName<
        typeof routerV2Contract.abi,
        "payable" | "nonpayable"
      >[];
      let path: `0x${string}`[] = [];

      if (fromAddress === zeroAddress) {
        path = [weth, toAddress];
        methods = [
          "swapETHForExactTokens",
          "swapExactETHForTokensSupportingFeeOnTransferTokens",
        ];
      } else if (toAddress === zeroAddress) {
        path = [fromAddress, weth];
        methods = [
          "swapExactTokensForETH",
          "swapExactTokensForETHSupportingFeeOnTransferTokens",
        ];
      } else {
        path = [fromAddress, toAddress];
        methods = [
          "swapExactTokensForTokens",
          "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        ];
      }

      const params = [amount, amountOutMin, path, address, deadline] as const;

      const ethParams = [amountOutMin, path, address, deadline] as const;

      const options = {
        abi: routerV2Contract.abi,
        address: routerV2Contract.address,
        account: address,
        value: path[0] === weth ? amount : (undefined as any),
        args: path[0] === weth ? ethParams : (params as any),
      } as const;

      const estimateGas = await Promise.all(
        methods.map((method) =>
          estimateContractGas(publicClient, {
            ...options,
            functionName: method,
          })
            .then(() => method)
            .catch(() => undefined)
        )
      );

      const swapMethod = estimateGas.find((g) => g !== undefined);

      if (!swapMethod) return;

      const simulate = await simulateContract(publicClient, {
        ...options,
        functionName: swapMethod,
      });

      const hash = await walletClient.writeContract(simulate.request);

      // api.post("/exchange-transactions", {
      //   wallet_address: address,
      //   token_from: tokenFrom.symbol,
      //   token_to: tokenTo.symbol,
      //   amount_from: valueFrom,
      //   amount_to: valueTo,
      //   chain_id: chain.id,
      //   transaction_hash: hash,
      // });

      return hash;
    } catch (error: any) {
      console.log("swap", error);
      toast.error(
        error?.walk?.().message ||
          error?.message ||
          "Signing failed, please try again!"
      );
    }
  };

  const transfer = async (amount: string, token: Token, to: `0x${string}`) => {
    if (!address || !walletClient) return;
    let hash: `0x${string}` | undefined;
    try {
      const value = parseUnits(amount, token.decimals);
      if (token.address) {
        const { request } = await publicClient.simulateContract({
          abi: erc20Abi,
          address: token.address,
          functionName: "transfer",
          args: [to, value],
          account: address,
        });

        hash = await walletClient.writeContract(request);
      } else {
        hash = await walletClient.sendTransaction({ to, value });
      }

      // api.post("/transfer-transactions", {
      //   to,
      //   wallet_address: address,
      //   token: token.symbol,
      //   amount: amount,
      //   chain_id: chain.id,
      //   transaction_hash: hash,
      // });

      return hash;
    } catch (error: any) {
      toast.error(
        error?.walk?.().message ||
          error?.message ||
          "Signing failed, please try again!"
      );
    }
  };

  const addTokenAsset = async (token?: Token) => {
    if (!token || !walletClient || !token.address) return;
    try {
      await walletClient?.watchAsset({
        type: "ERC20",
        options: {
          address: token.address,
          symbol: token?.symbol,
          decimals: token.decimals ?? 18,
          image:
            token.logoURI &&
            (token.logoURI.includes("http")
              ? token.logoURI
              : `${window.location.origin}${token.logoURI}`),
        },
      });
      toast.success("Token imported to metamask successfully");
    } catch (e: unknown) {
      console.log(e);
      toast.error("Token import failed");
    }
  };

  const addLiquidity = async (
    [tokenA, tokenB]: Token[],
    [valueA, valueB]: string[]
  ) => {
    if (!address || !walletClient) return;

    try {
      const amountA = parseUnits(valueA, tokenA.decimals);
      const amountB = parseUnits(valueB, tokenB.decimals);

      let simulate;
      const block = await publicClient.getBlock();
      const deadline = deadlineFrom(block.timestamp, txDeadline);
      const amountAMin = applySlippage(amountA, slippageTolerance);
      const amountBMin = applySlippage(amountB, slippageTolerance);

      if (tokenB.address && tokenA.symbol === chain.nativeCurrency.symbol) {
        simulate = await routerV2Contract.simulate.addLiquidityETH(
          [tokenB.address, amountB, amountBMin, amountAMin, address, deadline],
          { account: address, value: amountA }
        );
      } else if (
        tokenA.address &&
        tokenB.symbol === chain.nativeCurrency.symbol
      ) {
        simulate = await routerV2Contract.simulate.addLiquidityETH(
          [tokenA.address, amountA, amountAMin, amountBMin, address, deadline],
          { account: address, value: amountB }
        );
      } else if (tokenA.address && tokenB.address) {
        simulate = await routerV2Contract.simulate.addLiquidity(
          [
            tokenA.address,
            tokenB.address,
            amountA,
            amountB,
            amountAMin,
            amountBMin,
            address,
            deadline,
          ],
          { account: address }
        );
      }

      if (!simulate?.request) return;
      // TODO: fix this type error
      const hash = await walletClient.writeContract(simulate.request as any);

      publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (error: any) {
      console.log(error);
      toast.error(
        error?.walk?.().message ||
          error?.message ||
          "Signing failed, please try again!"
      );
    }
  };

  const removeLiquidity = async (
    pair: Pair,
    signature: Signature & { deadline: bigint },
    percent: number
  ) => {
    if (!address || !walletClient) return;

    try {
      let simulate;

      const liquidity = (pair.liquidity * BigInt(percent)) / 100n;
      const amountMin0 = applySlippageToRatio(
        liquidity * pair.reserve0,
        pair.totalSupply,
        slippageTolerance
      );
      const amountMin1 = applySlippageToRatio(
        liquidity * pair.reserve1,
        pair.totalSupply,
        slippageTolerance
      );

      const params = [
        address,
        signature.deadline,
        false,
        Number(signature.v),
        signature.r,
        signature.s,
      ] as const;

      if (
        pair.token1.address &&
        pair.token0.symbol === chain.nativeCurrency.symbol
      ) {
        simulate = await routerV2Contract.simulate.removeLiquidityETHWithPermit(
          [pair.token1.address, liquidity, amountMin1, amountMin0, ...params],
          { account: address }
        );
      } else if (
        pair.token0.address &&
        pair.token1.symbol === chain.nativeCurrency.symbol
      ) {
        simulate = await routerV2Contract.simulate.removeLiquidityETHWithPermit(
          [pair.token0.address, liquidity, amountMin0, amountMin1, ...params],
          { account: address }
        );
      } else if (pair.token0.address && pair.token1.address) {
        simulate = await routerV2Contract.simulate.removeLiquidityWithPermit(
          [
            pair.token0.address,
            pair.token1.address,
            liquidity,
            amountMin0,
            amountMin1,
            ...params,
          ],
          { account: address }
        );
      }

      if (!simulate?.request) return;

      const hash = await walletClient.writeContract(simulate.request as any);

      publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (error: any) {
      toast.error(
        error?.walk?.().message ||
          error?.message ||
          "Signing failed, please try again!"
      );
    }
  };

  const signPremitMessage = async (pair: Pair, percent: number) => {
    if (!walletClient || !pair || !address) return;

    const deadline = deadlineFrom(Math.round(Date.now() / 1000), txDeadline);

    try {
      const nonce = await publicClient.readContract({
        abi: pairAbi,
        address: pair.address,
        functionName: "nonces",
        args: [address],
      });

      const signature = await walletClient.signTypedData({
        account: address,
        primaryType: "Permit",
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        domain: {
          chainId: chain.id,
          name: pair.name || "Uniswap V2",
          verifyingContract: pair.address,
          version: "1",
        },
        message: {
          owner: address,
          spender: routerV2Contract.address,
          value: (pair.liquidity * BigInt(percent)) / 100n,
          nonce,
          deadline,
        },
      });

      return { ...parseSignature(signature), deadline };
    } catch (e: any) {
      toast.error(
        e?.walk?.().message || e?.message || "Signing failed, please try again!"
      );
    }
  };

  return {
    swap,
    transfer,
    addLiquidity,
    addTokenAsset,
    checkAllowance,
    removeLiquidity,
    getAmountFromTo,
    signPremitMessage,
  };
};

export default useWeb3Functions;
