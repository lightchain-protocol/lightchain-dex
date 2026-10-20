'use client'
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import useUserStore from "@/store/user-store";
import {
  HIGH_SLIPPAGE,
  MAX_SLIPPAGE,
  MAX_TX_DEADLINE,
  MIN_SLIPPAGE,
  MIN_TX_DEADLINE,
  normalizeSlippage,
  normalizeTxDeadline,
} from "@/lib/slippage";
import { DialogClose } from "@radix-ui/react-dialog";
import { SettingsIcon } from "lucide-react";
import type { JSX } from "react";

const slippageToleranceOptions = [0.1, 0.5, 1];

type Props = {
  trigger?: JSX.Element;
  className?: string;
};

export function SettingModal({ trigger, className }: Props) {
  const { slippageTolerance, txDeadline } = useUserStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button className={cn("text-primary bg-transparent hover:bg-[var(--clr-gray-200)] dark:hover:bg-[var(--clr-blackest)] hover:text-[var(--clr-primary)]", className)} size={"icon"}>
            <SettingsIcon size={20} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="gap-3 sm:max-w-[404px] dark:bg-[var(--clr-blackest)] border border-transparent dark:border-[rgba(91,75,255,0.10)]" hideCloseButton>
        <div className="hidden dark:block w-[calc(100%-0px)] h-[calc(100%-0px)] bg-[linear-gradient(329deg,#14152C_0%,#34306D_100%)] rounded-[10px] absolute left-1/2 top-1/2 -translate-1/2 z-[-1]" />
        <DialogClose className="w-8! h-8 rounded-full border border-[var(--clr-border-light)] dark:border-[#2B294D] bg-[#EFEFFF] dark:bg-[var(--clr-blackest)] absolute -top-2 -right-2 hover:text-[var(--clr-primary)] transition-all duration-300">
          <i className="fa-regular fa-close"></i>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-[-1px]">{"Settings"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="block mb-4 md:mb-6 text-lg leading-[1.33] text-[var(--clr-black)] dark:text-[var(--clr-heading)]">
              Slippage Tolerance
            </Label>
            <div className="grid grid-cols-4 gap-1 md:gap-2">
              {slippageToleranceOptions.map((option, key) => (
                <Button
                  key={key}
                  variant={"secondary"}
                  onClick={() =>
                    useUserStore.setState({ slippageTolerance: option })
                  }
                  className="h-10 py-[9px] md:text-base text-[var(--clr-black)] dark:text-[var(--clr-heading)] bg-[#EFEFFF] dark:bg-[rgba(255,255,255,0.10)] hover:bg-[#EFEFFF]  hover:text-[var(--clr-primary)] dark:hover:text-[var(--clr-primary)] border-2 border-transparent hover:border[rgba(0, 0, 0, 0.05)] dark:hover:border-[rgba(255,255,255,0.10)]"
                >
                  {option}%
                </Button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  className="h-10 py-[9px] md:text-base dark:bg-transparent"
                  value={slippageTolerance}
                  type="number"
                  step={0.1}
                  min={MIN_SLIPPAGE}
                  max={MAX_SLIPPAGE}
                  onChange={(e) =>
                    useUserStore.setState({
                      slippageTolerance: Number(e.target.value),
                    })
                  }
                  onBlur={() =>
                    useUserStore.setState({
                      slippageTolerance: normalizeSlippage(slippageTolerance),
                    })
                  }
                />
                %
              </div>
            </div>
            {slippageTolerance < 0.5 && (
              <p className="mt-1 text-sm text-yellow-600 ">
                Your transaction may fail
              </p>
            )}
            {slippageTolerance > HIGH_SLIPPAGE && (
              <p className="mt-1 text-sm text-yellow-600 ">
                {slippageTolerance > MAX_SLIPPAGE
                  ? `Slippage is capped at ${MAX_SLIPPAGE}%`
                  : "High slippage: you may receive much less than quoted"}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-lg font-normal leading-[1.33] text-[var(--clr-black)] dark:text-[var(--clr-heading)]">
              Tx deadline (mins)
            </Label>
            <Input
              type="number"
              className="w-16 md:w-20 h-10 py-[9px] md:text-base bg-[#EFEFFF] dark:bg-[rgba(255,255,255,0.10)] text-center"
              min={MIN_TX_DEADLINE}
              max={MAX_TX_DEADLINE}
              step={1}
              value={txDeadline}
              onChange={(e) =>
                useUserStore.setState({ txDeadline: Number(e.target.value) })
              }
              onBlur={() =>
                useUserStore.setState({
                  txDeadline: normalizeTxDeadline(txDeadline),
                })
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
