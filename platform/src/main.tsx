import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { themes, steps, type ThemeKey } from "./content";
const downloadBook = async (p: any, kit = false) =>
  (await import("./pdf")).downloadBook(p, kit);
import "./style.css";
type Config = { mode: string; authReady: boolean; sales: boolean };
async function api(path: string, body?: any, method?: string) {
  const r = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await r.json();
  if (!r.ok) throw Error(data.error || "Le service est indisponible.");
  return data;
}
const fmt = (n: number) =>
  new Date(n).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const initialPair = new URLSearchParams(location.hash.slice(1)).get("pair");
if (initialPair) history.replaceState(null, "", location.pathname);
function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [me, setMe] = useState<any>(null),
    [view, setView] = useState("home"),
    [id, setId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [parties, setParties] = useState<any[]>([]);
  const run = async (fn: () => Promise<any>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };
  const loadMe = async () => {
    try {
      const u = await api("/me");
      setMe(u);
      if (u.device) {
        setId(u.device.party);
        setView(u.device.role === "display" ? "display" : "party");
      } else {
        setParties(await api("/parties"));
        setView("dashboard");
      }
    } catch {
      /* Visitor remains on the public page. */
    }
  };
  useEffect(() => {
    api("/config")
      .then(setConfig)
      .catch(() =>
        setError(
          "Connexion au service impossible. Les informations de présentation restent disponibles.",
        ),
      );
    if (initialPair)
      run(async () => {
        const p = await api("/pair", { code: initialPair });
        setId(p.party);
        setView(p.role === "display" ? "display" : "party");
      });
    else loadMe();
  }, []);
  const enter = () => (me ? setView("dashboard") : setView("login"));
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("home");
          }}
        >
          <span>✳</span> pixel.
        </a>
        <nav>
          <a href="#experience" onClick={() => setView("home")}>
            L’expérience
          </a>
          <a href="#offer" onClick={() => setView("home")}>
            Le forfait
          </a>
          <button className="outline" onClick={enter}>
            {me ? "Mon espace" : "Espace parent"} ↗
          </button>
        </nav>
      </header>
      {config?.mode === "local" && (
        <div className="mode-banner">
          ATELIER LOCAL · Paiement simulé · Les images reprennent le dessin
          importé, sans appel IA.
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
          <button aria-label="Fermer le message" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {view === "home" && (
        <>
          <section className="hero">
            <div>
              <p className="eyebrow">
                L’ANNIVERSAIRE QU’ILS INVENTENT. LA FÊTE QUE VOUS ANIMEZ.
              </p>
              <h1>
                Leurs dessins.
                <br />
                Leurs héros.
                <br />
                <em>
                  Votre plus
                  <br />
                  belle fête.
                </em>
              </h1>
              <p className="lead">
                Transformez leurs idées en une aventure à partager. Pixel vous
                guide, pas à pas, pour animer vous-même un anniversaire créatif
                avec l’IA.
              </p>
              <div className="actions">
                <button onClick={enter}>Découvrir mon espace parent ↗</button>
                <a className="text-link" href="#experience">
                  Comment ça marche ↓
                </a>
              </div>
              <div className="facts">
                <span>8–12 ans</span>
                <span>Jusqu’à 10 enfants</span>
                <span>Aucune expérience requise</span>
              </div>
            </div>
            <div className="hero-art">
              <span className="note top">
                Le grand pouvoir ? Leur imagination.
              </span>
              <div className="sketch">
                MON HÉROS
                <br />
                <span>
                  ✧<br />♧
                </span>
                <small>Un crayon. Une idée. Et c’est parti.</small>
              </div>
              <img
                src="/pixel.svg"
                alt="Pixel, un petit héros violet avec une étoile dorée"
              />
              <span className="burst">✦</span>
              <span className="note bottom">
                Vous guidez. Ils créent. Tout le monde joue.
              </span>
            </div>
          </section>
          <div className="ribbon">
            Pas de matériel compliqué <b>✳</b> Un vrai moment ensemble <b>✳</b>{" "}
            Des souvenirs à garder
          </div>
          <section id="experience">
            <p className="eyebrow">LE PETIT COUP DE POUCE DES GRANDES FÊTES</p>
            <h2>
              Vous n’avez pas besoin d’être expert.
              <br />
              <em>Juste d’être leur complice.</em>
            </h2>
            <div className="cards three">
              {[
                [
                  "01",
                  "Préparez à votre rythme",
                  "Choisissez un univers, lisez le conducteur et essayez une création avant le jour J. Le compteur n’a pas encore démarré.",
                ],
                [
                  "02",
                  "Ouvrez l’aventure",
                  "Le jour de la fête, activez vos quatre heures. Dessins, créations et défis : vous suivez les étapes et gardez la main.",
                ],
                [
                  "03",
                  "Gardez les souvenirs",
                  "Téléchargez les héros et le livret de votre aventure. Votre galerie reste accessible trente jours après la session.",
                ],
              ].map(([n, t, p]) => (
                <article key={n}>
                  <span className="number">{n}</span>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="tinted">
            <div className="section-head">
              <div>
                <p className="eyebrow">TROIS PORTES VERS L’IMAGINAIRE</p>
                <h2>
                  Quelle sera <em>leur mission ?</em>
                </h2>
              </div>
              <p>
                Des aventures balisées, des choix à faire ensemble et une place
                pour chaque héros.
              </p>
            </div>
            <div className="cards three">
              {Object.entries(themes).map(([key, t]) => (
                <article
                  className="theme-card"
                  style={{ background: t.color }}
                  key={key}
                >
                  <span className="theme-symbol">{t.emoji}</span>
                  <h3>{t.name}</h3>
                  <p>{t.hook}</p>
                  <span className="pill">Dessins · Histoire · Défis</span>
                </article>
              ))}
            </div>
          </section>
          <section className="split" id="offer">
            <div>
              <p className="eyebrow">UN FORFAIT. TOUTE LA BANDE.</p>
              <h2>
                Une fête qui leur ressemble.
                <br />
                <em>Un budget tout simple.</em>
              </h2>
              <p className="lead">
                Le même prix en France et en Suisse, exprimé en euros. Aucun
                abonnement, aucun achat supplémentaire pendant la fête.
              </p>
              <div className="small-card">
                <strong>À la maison, prévoyez simplement :</strong>
                <p>
                  Un ordinateur, un téléphone, Internet, des feuilles et des
                  crayons. Une TV est facultative. Le parent anime et reste
                  présent.
                </p>
              </div>
            </div>
            <article className="price-card">
              <span className="pill">
                {config?.sales
                  ? "LE FORFAIT PIXEL"
                  : "OFFRE PRÉVUE · PILOTE PRIVÉ"}
              </span>
              <div className="price">
                39 <span>€ / fête</span>
              </div>
              <p>Jusqu’à 10 enfants · 8–12 ans</p>
              <ul>
                <li>4 heures d’accès, activables sous 6 mois</li>
                <li>Un essai avant la fête + 20 images incluses</li>
                <li>Un conducteur complet pour environ 2 heures</li>
                <li>3 univers au choix et des activités sans écran</li>
                <li>Un écran parent pour valider les créations</li>
                <li>Galerie 30 jours et livret PDF à télécharger</li>
              </ul>
              <button onClick={enter}>
                {config?.sales
                  ? "Préparer mon anniversaire"
                  : "Accéder au pilote sur invitation"}{" "}
                ↗
              </button>
              <p className="fine">
                {config?.sales
                  ? "Paiement en euros. Votre banque peut appliquer des frais de conversion."
                  : "Les ventes ne sont pas encore ouvertes. Le pilote permet de tester le parcours avant son lancement commercial."}
              </p>
            </article>
          </section>
          <section>
            <p className="eyebrow">DEUX HEURES À LEUR RYTHME</p>
            <h2>
              Un fil conducteur.
              <br />
              <em>De la place pour leurs idées.</em>
            </h2>
            <div className="timeline">
              {steps.map((s, i) => (
                <article key={s.title}>
                  <span>
                    0{i + 1} · {s.time}
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.action}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="tinted split">
            <div>
              <p className="eyebrow">LE PARENT GARDE LA MAIN</p>
              <h2>
                La technologie accompagne.
                <br />
                <em>Les enfants inventent.</em>
              </h2>
            </div>
            <div>
              <p>
                Seul l’adulte utilise l’outil. Sur votre téléphone, vous
                regardez les créations avant de les partager sur l’écran
                collectif.
              </p>
              <ul>
                <li>Des dessins uniquement, sans photos d’enfants.</li>
                <li>Des pseudonymes et aucun compte enfant.</li>
                <li>Pas de dialogue libre avec un chatbot.</li>
                <li>Un plan sur papier si une génération tarde ou échoue.</li>
              </ul>
              <p className="fine">
                Les dessins sont traités par un service IA. Les conditions et
                les accords nécessaires seront présentés avant la session.
                L’assistance se fait par e-mail, sans permanence pendant la
                fête.
              </p>
            </div>
          </section>
          <section className="faq">
            <h2>
              Avant de souffler <em>les bougies.</em>
            </h2>
            {[
              [
                "Quand démarrent les quatre heures ?",
                "Uniquement lorsque vous confirmez l’activation. Vous pouvez préparer et essayer avant. La session continue pendant vos pauses et ne redémarre pas si vous fermez votre navigateur.",
              ],
              [
                "Et si une image ne me plaît pas ?",
                "Vous pouvez demander une variante avec un nouveau dessin importé : elle utilise un crédit. Une erreur technique ne consomme pas de crédit. Vous voyez toujours combien de créations restent disponibles.",
              ],
              [
                "Faut-il être à Genève ou dans le Pays de Gex ?",
                "Non : Pixel est une plateforme en français utilisable à distance. Le forfait est exprimé en euros, y compris pour les familles suisses.",
              ],
              [
                "Que faire en cas de panne ?",
                "Continuez avec les dessins et les activités du kit imprimé. Une panne confirmée peut donner lieu à une prolongation ou à un remboursement. Le support répond par e-mail sans garantie de réponse en direct.",
              ],
              [
                "Que deviennent les créations ?",
                "Le parent peut télécharger les créations approuvées pendant trente jours après la session. Elles ne sont pas publiées dans une galerie publique.",
              ],
              [
                "Comment participer au pilote ?",
                "Écrivez à svanou@gmail.com. Les premières familles testent le parcours sur invitation avant l’ouverture des ventes.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
          <section className="cta">
            <p className="eyebrow">LE PROCHAIN CHAPITRE COMMENCE CHEZ VOUS</p>
            <h2>
              Prêts à inventer
              <br />
              <em>une belle fête ?</em>
            </h2>
            <a
              className="button"
              href="mailto:svanou@gmail.com?subject=Participer%20au%20pilote%20Pixel"
            >
              Demander une invitation ↗
            </a>
          </section>
        </>
      )}
      {view === "login" && (
        <main className="narrow">
          <p className="eyebrow">BIENVENUE DANS VOTRE ATELIER</p>
          <h1 className="small-title">
            Un lien.
            <br />
            <em>Et l’aventure commence.</em>
          </h1>
          <p>
            Votre espace parent est accessible sans mot de passe. Pendant le
            pilote, une invitation est nécessaire.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                if (config?.mode === "local") {
                  await api("/local/login", { email });
                  await loadMe();
                } else {
                  await api("/auth/sign-in/magic-link", {
                    email,
                    callbackURL: location.origin,
                  });
                  setSent(true);
                }
              });
            }}
          >
            <label>
              Votre e-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button
              disabled={
                busy || (!config?.authReady && config?.mode !== "local")
              }
            >
              {config?.mode === "local"
                ? "Ouvrir la simulation locale"
                : "Recevoir mon lien de connexion"}
            </button>
          </form>
          {sent && (
            <p role="status">
              Si votre adresse est invitée, un lien valable dix minutes vous
              sera envoyé. Consultez aussi les courriers indésirables.
            </p>
          )}
          {!config?.authReady && config?.mode !== "local" && (
            <p>
              Le pilote est en cours de configuration. Contact :{" "}
              <a href="mailto:svanou@gmail.com">svanou@gmail.com</a>.
            </p>
          )}
        </main>
      )}
      {view === "dashboard" && (
        <main>
          <div className="section-head">
            <div>
              <p className="eyebrow">VOTRE ESPACE PARENT</p>
              <h1 className="small-title">
                De belles fêtes
                <br />
                <em>en préparation.</em>
              </h1>
              <p>{me?.email}</p>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    await api("/logout", {});
                    location.href = location.origin;
                  })
                }
              >
                Me déconnecter
              </button>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (config?.mode === "local") {
                    const r = await api("/local/party", {});
                    setId(r.id);
                    setView("party");
                  } else {
                    const r = await api("/checkout", {});
                    location.href = r.url;
                  }
                })
              }
            >
              {config?.mode === "local"
                ? "Créer un forfait de simulation"
                : config?.mode === "pilot"
                  ? "Obtenir un forfait (paiement test)"
                  : "Préparer une fête · 39 €"}
            </button>
          </div>
          {new URLSearchParams(location.search).get("payment") ===
            "success" && (
            <p className="notice">
              Le paiement est en cours de confirmation. Actualisez la liste dans
              quelques instants.
            </p>
          )}
          <button
            className="outline"
            onClick={() => run(async () => setParties(await api("/parties")))}
          >
            Actualiser mes fêtes
          </button>
          <div className="cards three party-list">
            {parties.map((p) => (
              <article key={p.id}>
                <span className="pill">
                  {{
                    preparation: "À préparer",
                    active: "En cours",
                    gallery: "Souvenirs",
                    expired: "Activation expirée",
                  }[p.phase as string] || p.phase}
                </span>
                <h3>{themes[p.theme as ThemeKey].name}</h3>
                <p>
                  {p.ends_at
                    ? "Session du " + fmt(p.activated_at)
                    : "À activer avant le " + fmt(p.activate_by)}
                </p>
                <button
                  className="outline"
                  onClick={() => {
                    setId(p.id);
                    setView("party");
                  }}
                >
                  Ouvrir la fête ↗
                </button>
              </article>
            ))}
          </div>
          {!parties.length && (
            <p className="empty">
              Votre première aventure vous attend. Créez un forfait pour choisir
              son univers.
            </p>
          )}
          {me?.admin && <Admin run={run} />}
        </main>
      )}
      {(view === "party" || view === "display") && (
        <Party
          id={id}
          display={view === "display"}
          config={config}
          run={run}
          busy={busy}
          back={() => {
            loadMe();
          }}
        />
      )}
      <footer>
        <span className="brand">
          <span>✳</span> pixel.
        </span>
        <p>De grandes aventures pour de petits créateurs.</p>
        <a href="mailto:svanou@gmail.com">Nous écrire</a>
        <button
          className="link"
          onClick={() => setView(view === "privacy" ? "home" : "privacy")}
        >
          Confidentialité & informations
        </button>
      </footer>
      {view === "privacy" && (
        <main className="narrow">
          <h2>Informations du pilote</h2>
          <p>
            Pixel est un projet présenté par Sylvain. Contact :
            svanou@gmail.com. Les ventes publiques restent fermées pendant le
            pilote privé.
          </p>
          <p>
            Seul un adulte peut utiliser le service. Les pseudonymes et les
            dessins servent à personnaliser l’activité. Ne transmettez aucune
            photo d’enfant ni donnée sensible. Les originaux sont supprimés
            après traitement, au plus tard sous 24 heures ; les souvenirs
            expirent 30 jours après la session. Les données techniques
            nécessaires au compte et à la gestion des demandes sont distinctes.
          </p>
          <p>
            Les services prévus sont Cloudflare (hébergement), Resend (e-mails),
            Stripe (paiement) et OpenAI (génération). Les cookies sont limités à
            la connexion et à l’association des appareils. Aucun suivi
            publicitaire ni galerie publique.
          </p>
          <p>
            Pour demander l’accès, la correction ou la suppression de vos
            données : svanou@gmail.com. L’identité complète du vendeur, les
            conditions de vente, la fiscalité et les informations réglementaires
            seront complétées avant l’ouverture des paiements réels.
          </p>
        </main>
      )}
    </>
  );
}
function Party({
  id,
  display,
  config,
  run,
  busy,
  back,
}: {
  id: string;
  display: boolean;
  config: Config | null;
  run: (f: () => Promise<any>) => Promise<void>;
  busy: boolean;
  back: () => void;
}) {
  const [p, setP] = useState<any>(null),
    [theme, setTheme] = useState<ThemeKey>("forest"),
    [names, setNames] = useState(""),
    [alias, setAlias] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [qr, setQr] = useState(""),
    [pairURL, setPairURL] = useState(""),
    [confirm, setConfirm] = useState(false),
    [remaining, setRemaining] = useState(""),
    [offline, setOffline] = useState(false),
    [init, setInit] = useState(false);
  const refresh = useCallback(async () => {
    const data = await api("/parties/" + id);
    setP(data);
    setOffline(false);
    if (!init) {
      setTheme(data.theme);
      setNames(data.names.join("\n"));
      setAlias(data.names[0] || "");
      setInit(true);
    }
  }, [id, init]);
  useEffect(() => {
    run(refresh);
    const t = setInterval(() => refresh().catch(() => setOffline(true)), 4000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!p?.ends_at) return;
    const serverOffset = p.now - Date.now();
    const tick = () => {
      const secs = Math.max(
        0,
        Math.ceil((p.ends_at - Date.now() - serverOffset) / 1000),
      );
      setRemaining(
        `${Math.floor(secs / 3600)}h ${String(Math.floor(secs / 60) % 60).padStart(2, "0")}m ${String(secs % 60).padStart(2, "0")}s`,
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [p]);
  if (!p)
    return (
      <main>
        <p>Ouverture de votre aventure…</p>
      </main>
    );
  const t = themes[p.theme as ThemeKey],
    active = p.phase === "active",
    prep = p.phase === "preparation";
  const change = async (path: string, data: any) => {
    await api(`/parties/${id}/${path}`, data);
    await refresh();
  };
  const connect = async (role: string) => {
    const data = await api(`/parties/${id}/pair`, { role });
    setPairURL(data.url);
    setQr(await QRCode.toDataURL(data.url, { margin: 2, width: 240 }));
  };
  async function generate() {
    if (!file) throw Error("Ajoutez une photo du dessin.");
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 12_000_000
    )
      throw Error("Choisissez une image JPEG ou PNG de moins de 12 Mo.");
    const img = await createImageBitmap(file).catch(() => {
      throw Error(
        "Cette image est illisible. Choisissez une autre photo du dessin.",
      );
    });
    if (img.width * img.height > 30_000_000) {
      img.close();
      throw Error("Réduisez la résolution du dessin.");
    }
    const ratio = Math.min(1, 1024 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Image illisible."))),
        "image/jpeg",
        0.9,
      ),
    );
    const body = new FormData();
    body.set("image", blob, "dessin.jpg");
    const r = await fetch(`/api/parties/${id}/upload`, {
      method: "POST",
      body,
    });
    const u: any = await r.json();
    if (!r.ok) throw Error(u.error);
    await change("generate", {
      id: crypto.randomUUID(),
      upload: u.id,
      alias,
      kind: prep ? "trial" : "image",
    });
    setFile(null);
  }
  if (display)
    return (
      <main className="display">
        <p className="eyebrow">BIENVENUE DANS VOTRE AVENTURE</p>
        <h1 className="small-title">{t.name}</h1>
        <h2>{steps[p.step].title}</h2>
        {offline && (
          <p className="notice">
            La connexion est interrompue. L’aventure continue sur papier.
          </p>
        )}
        <p className="lead">{steps[p.step].read}</p>
        {p.story_approved &&
          p.step === 3 &&
          p.story?.map((s: string, i: number) => (
            <article className="scene" key={i}>
              <p>{s}</p>
              <strong>Défi : {t.challenges[i]}</strong>
            </article>
          ))}
        <div className="cards gallery">
          {p.jobs
            .filter((j: any) => j.approved)
            .map((j: any) => (
              <article key={j.id}>
                <img
                  src={`/api/parties/${id}/images/${j.id}`}
                  alt={`Héros ${j.alias}`}
                />
                <h3>{j.alias}</h3>
              </article>
            ))}
        </div>
      </main>
    );
  return (
    <main>
      <div className="section-head">
        <div>
          <button className="link" onClick={back}>
            ← Mes fêtes
          </button>
          <p className="eyebrow">
            VOTRE ATELIER ·{" "}
            {prep ? "PRÉPARATION" : active ? "ANIMATION" : "SOUVENIRS"}
          </p>
          <h1 className="small-title">{t.name}</h1>
        </div>
        <div className="session-stats">
          <strong>
            {active ? remaining : prep ? "À votre rythme" : "Session terminée"}
          </strong>
          <span>{p.credits} / 20 créations disponibles</span>
          <span>
            {prep
              ? "Activation avant " + fmt(p.activate_by)
              : "Souvenirs jusqu’au " + fmt(p.retain_until)}
          </span>
        </div>
      </div>
      {offline && (
        <p className="error" role="alert">
          Connexion interrompue. Les informations affichées peuvent être
          anciennes. Continuez avec le kit papier ; le compteur ne s’arrête pas.
        </p>
      )}
      <div className="actions">
        <button
          className="outline"
          onClick={() => run(() => downloadBook(p, true))}
        >
          ↓ Télécharger le kit parent
        </button>
        {(prep || active) && (
          <>
            <button
              className="outline"
              onClick={() => run(() => connect("control"))}
            >
              Associer mon téléphone
            </button>
            <button
              className="outline"
              onClick={() => run(() => connect("display"))}
            >
              Ouvrir l’écran de fête
            </button>
          </>
        )}
        <button className="outline" onClick={() => run(() => downloadBook(p))}>
          ↓ Livret souvenir
        </button>
      </div>
      {qr && (
        <aside className="pair-panel">
          <img src={qr} alt="QR code privé d’association" />
          <div>
            <h3>Reliez votre appareil</h3>
            <p>
              Ouvrez ce lien sur l’autre appareil. Il est utilisable une seule
              fois pendant dix minutes. Gardez-le privé.
            </p>
            <a
              className="text-link"
              href={pairURL}
              target="_blank"
              rel="noopener"
            >
              Ouvrir dans une nouvelle fenêtre ↗
            </a>
            <button
              className="outline"
              onClick={() => run(() => navigator.clipboard.writeText(pairURL))}
            >
              Copier le lien
            </button>
            <button
              className="link"
              onClick={() => {
                setQr("");
                setPairURL("");
              }}
            >
              Fermer
            </button>
          </div>
        </aside>
      )}
      {prep && (
        <div className="workspace-grid">
          <article className="panel">
            <h2>
              Préparons <em>la fête.</em>
            </h2>
            <label>
              L’univers
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeKey)}
              >
                {Object.entries(themes).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Les pseudonymes (un par ligne, 10 maximum)
              <textarea
                rows={5}
                value={names}
                onChange={(e) => setNames(e.target.value)}
                placeholder={"Luna\nCapitaine Plume\nNova"}
              />
            </label>
            <p className="fine">
              N’utilisez pas de noms complets ou de renseignements personnels.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const list = names
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  await api("/parties/" + id, { theme, names: list }, "PUT");
                  setAlias(list[0] || "");
                  await refresh();
                })
              }
            >
              Enregistrer ma préparation
            </button>
          </article>
          <article className="panel tinted">
            <h3>Avant de démarrer</h3>
            <ul>
              <li>Préparez papier et crayons, chargez les appareils.</li>
              <li>Téléchargez le kit pour disposer du plan sans écran.</li>
              <li>Testez l’importation d’un dessin.</li>
              <li>
                Expliquez aux familles l’usage de l’IA et des pseudonymes.
              </li>
            </ul>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{" "}
              Je souhaite démarrer maintenant les quatre heures continues. Le
              compteur continuera pendant les pauses.
            </label>
            <button
              disabled={!confirm || busy || !p.names.length}
              onClick={() => run(() => change("activate", { confirm: true }))}
            >
              C’est le jour J : démarrer les 4 heures ↗
            </button>
            <p className="fine">
              Les accords contractuels applicables seront ajoutés avant
              l’ouverture des ventes. Le pilote utilise un paiement de test.
            </p>
          </article>
        </div>
      )}
      {active && (
        <section className="conductor">
          <p className="eyebrow">LE CONDUCTEUR · VOUS GARDEZ LA MAIN</p>
          <div className="step-tabs">
            {steps.map((s, i) => (
              <button
                key={i}
                className={p.step === i ? "" : "outline"}
                aria-current={p.step === i ? "step" : undefined}
                onClick={() => run(() => change("step", { step: i }))}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
          <article className="panel">
            <span className="pill">{steps[p.step].time} indicatives</span>
            <h2>{steps[p.step].title}</h2>
            <blockquote>{steps[p.step].read}</blockquote>
            <p>{steps[p.step].action}</p>
            <div className="small-card">
              <strong>Pendant une attente</strong>
              <p>{t.challenges[p.step % 3]}</p>
            </div>
          </article>
          {p.step === 3 && (
            <article className="panel">
              <h3>Votre histoire collective</h3>
              {!p.story && (
                <button
                  disabled={busy}
                  onClick={() => run(() => change("story", {}))}
                >
                  Préparer les trois scènes
                </button>
              )}
              {p.story?.length === 0 && (
                <p>
                  Préparation de l’histoire… Vous pouvez suivre la mission du
                  kit.
                </p>
              )}
              {p.story?.map((s: string, i: number) => (
                <div className="scene" key={i}>
                  <p>{s}</p>
                  <strong>Défi : {t.challenges[i]}</strong>
                </div>
              ))}
              {p.story?.length > 0 && (
                <button
                  className={p.story_approved ? "outline" : ""}
                  onClick={() =>
                    run(() =>
                      change("approve", {
                        job: "story",
                        approved: !p.story_approved,
                      }),
                    )
                  }
                >
                  {p.story_approved
                    ? "Retirer de l’écran de fête"
                    : "J’ai relu : montrer cette histoire"}
                </button>
              )}
            </article>
          )}
        </section>
      )}
      {(prep || active) && (
        <article className="panel create-panel">
          <div>
            <p className="eyebrow">
              {prep ? "VOTRE ESSAI AVANT LA FÊTE" : "DU DESSIN AU HÉROS"}
            </p>
            <h2>
              Un dessin.
              <br />
              <em>Mille possibles.</em>
            </h2>
            <p>
              {prep
                ? "Une génération d’essai est incluse, sans démarrer le compteur."
                : "Importez un dessin, puis validez son résultat avant de le montrer."}
            </p>
            {config?.mode === "local" && (
              <p className="notice">
                Simulation : le résultat sera une copie de votre dessin. Aucune
                transformation IA n’est effectuée localement.
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(generate);
            }}
          >
            <label>
              Le créateur
              <select
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                required
              >
                <option value="">Choisir un pseudonyme</option>
                {p.names.map((n: string) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="upload">
              Photographier ou choisir le dessin
              <input
                type="file"
                accept="image/png,image/jpeg"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && <span>{file.name}</span>}
            </label>
            <label className="checkbox">
              <input type="checkbox" required /> Je confirme que cette image
              contient uniquement un dessin, sans photo d’enfant ni information
              personnelle, et que son traitement par l’outil IA est autorisé.
            </label>
            <button
              disabled={
                busy ||
                offline ||
                !alias ||
                (prep && !p.trialAvailable) ||
                (!prep && p.credits <= 0)
              }
            >
              {prep
                ? p.trialAvailable
                  ? "Faire mon essai"
                  : "Essai déjà utilisé"
                : "Créer mon héros"}
            </button>
          </form>
        </article>
      )}
      <section>
        <p className="eyebrow">LES CRÉATIONS DU GROUPE</p>
        <h2>
          La galerie <em>des héros.</em>
        </h2>
        <p>
          Seules les créations approuvées apparaissent sur l’écran de fête et
          dans le livret.
        </p>
        <div className="cards gallery">
          {p.jobs.map((j: any) => (
            <article key={j.id}>
              {j.status === "done" ? (
                <img
                  src={`/api/parties/${id}/images/${j.id}`}
                  alt={`Création de ${j.alias}`}
                />
              ) : (
                <div className="image-placeholder">
                  {j.status === "failed" ? "↻" : "✧"}
                </div>
              )}
              <span className="pill">
                {j.kind === "trial"
                  ? "Essai"
                  : j.approved
                    ? "Approuvé"
                    : "Privé"}
              </span>
              <h3>{j.alias}</h3>
              {["running", "queued"].includes(j.status) && (
                <p role="status">
                  La création est en cours. Lancez un défi papier pendant
                  l’attente.
                </p>
              )}
              {j.status === "failed" && (
                <p>
                  La création n’a pas abouti
                  {j.error === "CONTENT_REJECTED"
                    ? " : le contenu ne convient pas au filtre"
                    : ""}
                  . Aucun crédit consommé. Importez un autre dessin pour
                  réessayer.
                </p>
              )}
              {j.status === "done" && (active || p.phase === "gallery") && (
                <button
                  className={j.approved ? "outline" : ""}
                  onClick={() =>
                    run(() =>
                      change("approve", { job: j.id, approved: !j.approved }),
                    )
                  }
                >
                  {j.approved ? "Retirer de l’écran" : "Valider et montrer"}
                </button>
              )}
              {j.status === "done" && (
                <a
                  className="text-link"
                  href={`/api/parties/${id}/images/${j.id}`}
                  download={`pixel-${j.alias}.jpg`}
                >
                  Télécharger l’image ↓
                </a>
              )}
            </article>
          ))}
        </div>
        {!p.jobs.length && (
          <p className="empty">Les premières créations apparaîtront ici.</p>
        )}
      </section>
    </main>
  );
}
function Admin({ run }: { run: (f: () => Promise<any>) => Promise<void> }) {
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState<any[]>([]),
    [reason, setReason] = useState("");
  return (
    <section className="panel">
      <h2>Assistance</h2>
      <label>
        Rechercher par e-mail
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <button
        onClick={() =>
          run(async () =>
            setRows(
              await api("/admin/parties?q=" + encodeURIComponent(search)),
            ),
          )
        }
      >
        Rechercher
      </button>
      <label>
        Motif de l’intervention
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={10}
        />
      </label>
      {rows.map((p) => (
        <article className="small-card" key={p.id}>
          <p>
            {p.owner} · {p.id} · {p.status}
          </p>
          <button
            className="outline"
            onClick={() =>
              run(() =>
                api("/admin/parties/" + p.id, {
                  action: "extend",
                  hours: 1,
                  reason,
                }),
              )
            }
          >
            Prolonger de 1 heure
          </button>
          <button
            className="outline"
            onClick={() =>
              run(() =>
                api("/admin/parties/" + p.id, { action: "revoke", reason }),
              )
            }
          >
            Révoquer l’accès
          </button>
        </article>
      ))}
      <p className="fine">
        Les remboursements sont traités dans Stripe. Toute intervention est
        enregistrée avec son motif.
      </p>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
