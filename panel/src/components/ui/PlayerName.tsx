import { PlayerIdentity, PlayerIdentityProps } from "./PlayerIdentity";

interface PlayerNameProps {
  name: string;
  factionId?: string | null;
  clanTag?: string | null;
  clanColor?: string | null;
  clanTagStyle?: string | null;
  href?: string;
  className?: string;
  clickable?: boolean;
}

export function PlayerName({
  name,
  factionId,
  clanTag,
  clanColor,
  clanTagStyle,
  href,
  className,
  clickable = true,
}: PlayerNameProps) {
  return (
    <PlayerIdentity
      username={name}
      factionId={factionId}
      clanTag={clanTag}
      clanColor={clanColor}
      clanTagStyle={clanTagStyle}
      href={href}
      className={className}
      clickable={clickable}
    />
  );
}
