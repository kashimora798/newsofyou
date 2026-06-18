import React from "react";
import CoinFlipOverlay from "./CoinFlipOverlay";
import DiceRollOverlay from "./DiceRollOverlay";
import EightBallOverlay from "./EightBallOverlay";
import HeartbeatOverlay from "./HeartbeatOverlay";
import MendingHeartOverlay from "./MendingHeartOverlay";
import FireRainOverlay from "./FireRainOverlay";
import MirrorOverlay from "./MirrorOverlay";
import SunriseOverlay from "./SunriseOverlay";
import StarryNightOverlay from "./StarryNightOverlay";
import LuckyNumberOverlay from "./LuckyNumberOverlay";
import FortuneCookieOverlay from "./FortuneCookieOverlay";
import ScratchCardOverlay from "./ScratchCardOverlay";
import MysteryPrizeOverlay from "./MysteryPrizeOverlay";
import BoredLauncherOverlay from "./BoredLauncherOverlay";
import { RpsRevealOverlay } from "./RpsOverlay";
import { decodeRps } from "@/lib/secretCommands";

// All secret full-screen effects flow through one host so Chat only tracks a
// single piece of state. New Phase-1 effects register here.
export type SecretOverlayKind =
  | "coinflip" | "diceroll" | "eightball"
  | "heartbeat" | "mend" | "fire" | "mirror"
  | "sunrise" | "starrynight" | "lucky" | "rps"
  | "fortune" | "scratch" | "mysteryprize" | "bored";

export interface SecretOverlayState {
  type: SecretOverlayKind;
  /** payload: coin/dice/8-ball result, lucky number, rps "mine|opp|outcome",
   *  or the fortune/quote text. */
  result?: string;
  /** lucky: both players landed on the same number. */
  matched?: boolean;
  /** rps: whether the local user is the one who played the round. */
  isMine?: boolean;
  /** mysteryprize payload */
  prize?: { emoji: string; title: string; note: string; milestone: number };
  senderName: string;
}

interface SecretOverlayHostProps {
  overlay: SecretOverlayState | null;
  onDismiss: () => void;
}

const SecretOverlayHost: React.FC<SecretOverlayHostProps> = ({ overlay, onDismiss }) => {
  if (!overlay) return null;
  const { type, result, matched, isMine, senderName } = overlay;

  switch (type) {
    case "coinflip":
      return <CoinFlipOverlay result={result === "tails" ? "tails" : "heads"} senderName={senderName} onDismiss={onDismiss} />;
    case "diceroll":
      return <DiceRollOverlay result={Number(result) || 1} senderName={senderName} onDismiss={onDismiss} />;
    case "eightball":
      return <EightBallOverlay answer={result ?? "..."} senderName={senderName} onDismiss={onDismiss} />;
    case "heartbeat":
      return <HeartbeatOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "mend":
      return <MendingHeartOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "fire":
      return <FireRainOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "mirror":
      return <MirrorOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "sunrise":
      return <SunriseOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "starrynight":
      return <StarryNightOverlay senderName={senderName} onDismiss={onDismiss} />;
    case "lucky":
      return <LuckyNumberOverlay number={Number(result) || 1} matched={!!matched} senderName={senderName} onDismiss={onDismiss} />;
    case "rps": {
      const { mine, opp, outcome } = decodeRps(result ?? "");
      return <RpsRevealOverlay mine={mine} opp={opp} outcome={outcome} senderName={senderName} isMine={!!isMine} onDismiss={onDismiss} />;
    }
    case "fortune":
      return <FortuneCookieOverlay fortune={result ?? "..."} onDismiss={onDismiss} />;
    case "scratch":
      return <ScratchCardOverlay quote={result ?? "..."} onDismiss={onDismiss} />;
    case "mysteryprize":
      return (
        <MysteryPrizeOverlay
          emoji={overlay.prize?.emoji ?? "🎁"}
          title={overlay.prize?.title ?? "Mystery Prize"}
          note={overlay.prize?.note ?? ""}
          milestone={overlay.prize?.milestone ?? 50}
          onDismiss={onDismiss}
        />
      );
    case "bored":
      return <BoredLauncherOverlay gameType={result ?? "tic_tac_toe"} isMine={!!isMine} onDismiss={onDismiss} />;
    default:
      return null;
  }
};

export default SecretOverlayHost;
