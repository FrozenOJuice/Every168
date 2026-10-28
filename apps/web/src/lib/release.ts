import { releaseFeatures } from "@168hours/contracts";

export const features = releaseFeatures(
  process.env.NEXT_PUBLIC_RELEASE_SCOPE === "preview" ? "preview" : "core",
);
