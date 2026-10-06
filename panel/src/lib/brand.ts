export const panelBrand = {
  name: process.env.NEXT_PUBLIC_SERVER_NAME || "Racket RPG",
  connectAddress: process.env.NEXT_PUBLIC_SERVER_IP || "play.racket.cat",
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/racket",
  /** Public panel release shown in site footer */
  panelVersion: process.env.NEXT_PUBLIC_PANEL_VERSION || "0.8.0",
};
