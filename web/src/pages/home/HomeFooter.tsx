import { useI18n } from "../../shell/i18n";
import { LegalFooter } from "../../shell/LegalFooter";

/* The home page alone carries the full footer: the brand, the site map in
   columns and the contact details. Every other page has the slim one. */

const COLUMNS = [
  {
    headKey: "foot_col_sections",
    links: [
      { href: "about.html", labelKey: "nav_about" },
      { href: "associations.html", labelKey: "nav_uyush" },
      { href: "showroom.html", labelKey: "nav_showroom" },
      { href: "xizmatlar.html", labelKey: "nav_svc_members" },
      { href: "davlat-xizmatlari.html", labelKey: "nav_gov_services" },
      { href: "biznes-id.html", labelKey: "nav_bizid" },
    ],
  },
  {
    headKey: "nav_markets",
    links: [
      { href: "bozor.html", labelKey: "nav_bozor" },
      { href: "moliya.html", labelKey: "nav_moliya" },
      { href: "mehnat.html", labelKey: "nav_mehnat" },
    ],
  },
  {
    headKey: "foot_col_cab",
    links: [
      { href: "kirish.html", labelKey: "foot_cab_in" },
      { href: "royxatdan-otish.html", labelKey: "nav_register" },
    ],
  },
] as const;

/* The same in every language, so not in the dictionary. */
const CONTACTS = [
  { href: "tel:+998900963377", label: "+998 90 096 33 77" },
  { href: "mailto:tijoratmarkazi@gmail.com", label: "tijoratmarkazi@gmail.com" },
] as const;

export function HomeFooter() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="container">
        <LegalFooter />
      </div>
      <div className="container footer-inner">
        <div className="footer-brand">
          <div>
            <strong>TIJORAT MARKAZI</strong>
            <p>{t("foot_tagline")}</p>
            <p className="foot-about">{t("foot_about_p")}</p>
          </div>
        </div>
        <div className="footer-cols">
          {COLUMNS.map(column => (
            <div key={column.headKey}>
              <h4>{t(column.headKey)}</h4>
              {column.links.map(link => (
                <a href={link.href} key={link.href}>
                  {t(link.labelKey)}
                </a>
              ))}
            </div>
          ))}
          <div>
            <h4>{t("foot_col3")}</h4>
            {CONTACTS.map(contact => (
              <a href={contact.href} key={contact.href}>
                {contact.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <a href="royxatdan-otish.html">{t("nav_register")}</a>
        <span>{t("foot_copy")}</span>
        <span>{t("foot_country")}</span>
      </div>
    </footer>
  );
}
