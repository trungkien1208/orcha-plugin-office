import { officeAssetUrl } from "../floor/asset-url";
import { LANDING_ART } from "./art.generated";
import { CAST } from "./data";

export const portraitUrl = (index: number) =>
  officeAssetUrl(LANDING_ART.portraits[CAST[index] ?? ""] ?? LANDING_ART.bossPortrait);

export function Portrait({ index = 0, boss = false }: { index?: number; boss?: boolean }) {
  const src = boss ? officeAssetUrl(LANDING_ART.bossPortrait) : portraitUrl(index);
  return <img className="portrait" src={src} width={56} height={56} alt="" />;
}

export function BrandLogo() {
  return (
    <span className="brand-lockup">
      <img className="brand-logo" src={officeAssetUrl(LANDING_ART.logo144)} srcSet={`${officeAssetUrl(LANDING_ART.logo144)} 144w, ${officeAssetUrl(LANDING_ART.logo224)} 224w`} sizes="72px" width={72} height={72} alt="" />
      <span className="brand-type">
        easy job<span className="brand-tagline">The Agent office</span>
      </span>
    </span>
  );
}
