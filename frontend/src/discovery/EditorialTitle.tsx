import { useI18n } from "../i18n";

/** Preserve the translated text while giving display headings an editorial line break. */
export function EditorialTitle({
  text,
  viWords,
  enWords,
}: {
  text: string;
  viWords: number;
  enWords: number;
}) {
  const { language } = useI18n();
  const words = text.split(" ");
  const split = language === "vi" ? viWords : enWords;
  return (
    <>
      {words.slice(0, split).join(" ")}{" "}
      <span className="editorial-outline">{words.slice(split).join(" ")}</span>
    </>
  );
}
