/** Public, build-time panel identity; change these values in the deployment env. */
export const panelBrand = {
  name: process.env.NEXT_PUBLIC_SERVER_NAME || "Racket RPG",
  connectAddress: process.env.NEXT_PUBLIC_SERVER_IP || "",
  discordUrl: process.env.NEXT_PUBLIC_DISCORD_URL || "",
};
