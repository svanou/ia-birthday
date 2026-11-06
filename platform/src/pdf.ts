import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { steps, themes, type ThemeKey } from "./content";
const clean = (s: string) => s.replace(/[^\x20-\x7e\u00a0-\u00ff]/g, " ");
export async function downloadBook(p: any, kit = false) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const addText = (title: string, paragraphs: string[]) => {
    let page = doc.addPage([595, 842]),
      y = 775;
    page.drawText(clean(title), {
      x: 45,
      y,
      size: 23,
      font: bold,
      color: rgb(0.35, 0.25, 0.58),
    });
    y -= 50;
    for (const para of paragraphs) {
      let line = "";
      for (const word of clean(para).split(" ")) {
        if (font.widthOfTextAtSize(line + word, 12) > 490) {
          page.drawText(line, { x: 45, y, size: 12, font });
          y -= 20;
          line = "";
          if (y < 60) {
            page = doc.addPage([595, 842]);
            y = 775;
          }
        }
        line += word + " ";
      }
      page.drawText(line, { x: 45, y, size: 12, font });
      y -= 40;
    }
  };
  const theme = themes[p.theme as ThemeKey];
  if (kit) {
    addText("Le kit du parent", [
      "Pixel - " + theme.name,
      "A prevoir : papier, crayons, ordinateur, telephone, connexion Internet. Pas de comptes enfants. Ne photographiez que les dessins.",
      "Avant la fete : choisissez un espace de creation, chargez vos appareils, faites votre essai. Prevoyez les activites papier si un outil ne repond pas.",
    ]);
    steps.forEach((s) => addText(s.title + " - " + s.time, [s.read, s.action]));
    addText("Les defis sans ecran", [
      ...theme.challenges,
      theme.hook,
      "Si Internet ne fonctionne pas, jouez avec les dessins originaux. Vous pouvez raconter vous-meme la mission et laisser les enfants inventer la suite.",
    ]);
  } else {
    addText("Notre aventure Pixel", [
      theme.name,
      "Les heros : " + p.names.join(", "),
      ...(p.story_approved && p.story ? p.story : [theme.hook]),
    ]);
    for (const j of p.jobs.filter(
      (j: any) => j.status === "done" && j.approved,
    )) {
      const r = await fetch(`/api/parties/${p.id}/images/${j.id}`);
      if (!r.ok)
        throw Error("Une image ne peut pas être téléchargée. Réessayez.");
      const bytes = await r.arrayBuffer();
      const img = r.headers.get("content-type")?.includes("jpeg")
        ? await doc.embedJpg(bytes)
        : await doc.embedPng(bytes);
      const page = doc.addPage([595, 842]);
      page.drawText(clean(j.alias), {
        x: 45,
        y: 765,
        size: 28,
        font: bold,
        color: rgb(0.35, 0.25, 0.58),
      });
      const size = img.scaleToFit(505, 610);
      page.drawImage(img, {
        x: (595 - size.width) / 2,
        y: 100 + (610 - size.height) / 2,
        width: size.width,
        height: size.height,
      });
      page.drawText(
        "Une creation imaginee par un enfant, accompagnee par Pixel.",
        { x: 45, y: 60, size: 10, font },
      );
    }
  }
  const bytes = await doc.save();
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = kit ? "pixel-kit-parent.pdf" : "pixel-notre-aventure.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
