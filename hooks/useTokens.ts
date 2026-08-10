import { useMemo } from "react";
import useTokenStore from "@/store/token-store";
import { Token } from "@/types/Token";
import { erc20Abi, isAddress } from "viem";
import useWeb3Clients from "./useWeb3Clients";
import useUserStore from "@/store/user-store";
import useCurrentChain from "./useCurrentChain";
import { isValidTokenMetadata } from "@/lib/token-metadata";

const useTokens = () => {
  const chain = useCurrentChain();
  const { publicClient } = useWeb3Clients();
  const userTokens = useUserStore();
  const listedTokens = useTokenStore();

  const listedTokensByChain = useMemo(() => {
    return listedTokens.tokens
      .filter((t) => t.chainId === chain.id)
      .reduce((acc, t) => {
        acc[t.address || t.symbol] = t;
        return acc;
      }, {} as Record<string, Token>);
  }, [listedTokens, chain]);

  const userTokensByChain = useMemo(() => {
    return userTokens.tokens[chain.id] || {};
  }, [userTokens, chain]);

  const tokens = useMemo<Token[]>(
    () =>
      Object.values({
        ...listedTokensByChain,
        ...userTokensByChain,
      }),
    [listedTokensByChain, userTokensByChain]
  );

  const pairTokens = useMemo(() => {
    const acc = [];
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        acc.push([tokens[i], tokens[j]]);
      }
    }
    return acc;
  }, [tokens]);

  const findToken = async (value: string) => {
    const token = tokens.find((t) =>
      isAddress(value)
        ? t.address?.toLowerCase() === value.toLowerCase()
        : t.symbol?.toLowerCase() === value.toLowerCase()
    );
    if (token) return token;
    if (isAddress(value)) {
      return await fetchToken(value);
    }
    return undefined;
  };

  const addToken = (token: Token & { address: `0x${string}` }) => {
    useUserStore.setState((state) => ({
      tokens: {
        ...state.tokens,
        [token.chainId]: {
          ...state.tokens[token.chainId],
          [token.address]: token,
        },
      },
    }));
  };

  const fetchToken = async (address: `0x${string}`): Promise<Token> => {
    const contractInfo = { abi: erc20Abi, address };
    const [name, symbol, decimals] = await publicClient.multicall({
      contracts: [
        { ...contractInfo, functionName: "name" },
        { ...contractInfo, functionName: "symbol" },
        { ...contractInfo, functionName: "decimals" },
      ],
    });
    if (!isValidTokenMetadata(name, symbol, decimals))
      throw new Error("Token not found");

    const newToken = {
      address,
      chainId: publicClient.chain.id,
      name: name.result!,
      symbol: symbol.result!,
      decimals: decimals.result!,
    };
    addToken(newToken);
    return newToken;
  };

  const fetchTokens = async () => {
    // const response = await fetch(
    //   "https://gateway.ipfs.io/ipns/tokens.uniswap.org",
    //   {
    //     cache: "force-cache",
    //   }
    // ).then((res) => res.json());
    // const tokens = response.tokens.map((token: Token) => ({
    //   chainId: token.chainId,
    //   symbol: token.symbol,
    //   name: token.name,
    //   address: token.address,
    //   logoURI: token.logoURI,
    //   decimals: token.decimals,
    // }));

    useTokenStore.setState({
      tokens: [...useTokenStore.getState().tokens, ...tokens],
    });
  };

  return {
    tokens,
    pairTokens,
    fetchTokens,
    findToken,
  };
};

export default useTokens;
