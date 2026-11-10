import { ContactRequestForm } from "./ContactRequestForm.tsx";
import { Testimonials } from "./Testimonials.tsx";
import { business, fullAddress } from "./_site/business";
import { Photo } from "./_site/Photo.tsx";
import { PhoneIcon, SiteHeader } from "./_site/SiteHeader.tsx";

const services = [
  {
    id: "washrooms",
    title: "Washrooms",
    photo: "project-washroom" as const,
    alt: "Renovated washroom with marble-look walls, a floating double vanity and a glass shower",
    text: "Full washroom rebuilds with careful tile work, vanities, showers, and lighting fitted to the room you have.",
    items: ["Tile walls and floors", "Vanities and showers", "Lighting and fixtures"],
  },
  {
    id: "interlock",
    title: "Interlock and landscaping",
    photo: "project-interlock" as const,
    alt: "New interlock patio in a fenced backyard",
    text: "Patios, walkways, and yards graded and laid so they drain properly and stay level for years.",
    items: ["Interlock patios and walkways", "Stone installation", "Yard grading"],
  },
  {
    id: "decks",
    title: "Decks",
    photo: "project-deck" as const,
    alt: "Backyard deck with built-in planters and a pergola",
    text: "Decks, pergolas, and built-in planters framed with durable materials and finished with care.",
    items: ["New decks and rebuilds", "Pergolas and planters", "Railings and stairs"],
  },
  {
    id: "kitchens",
    title: "Kitchens",
    photo: "project-kitchen" as const,
    alt: "Renovated kitchen with an island cooktop and stainless range hood",
    text: "Layouts that work for everyday cooking, from cabinetry and counters to flooring, lighting, and finishing details.",
    items: ["Cabinetry and counters", "Flooring and lighting", "Islands and custom finishes"],
  },
];

const steps = [
  {
    title: "Tell us about the job",
    text: "Call, or send the form below with a few photos. We reply to set up a time to see the space.",
  },
  {
    title: "We measure and price it",
    text: "We walk the site with you, confirm the scope, and send a written estimate before any work starts.",
  },
  {
    title: "We build and clean up",
    text: "The work is scheduled, you hear from us as it moves, and we finish with a walkthrough together.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "GeneralContractor",
  name: business.name,
  url: business.siteUrl,
  logo: `${business.siteUrl}/images/va-logo.png`,
  image: `${business.siteUrl}/images/og-va-contracting.jpg`,
  telephone: business.phoneE164,
  email: business.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: business.address.street,
    addressLocality: business.address.city,
    addressRegion: business.address.region,
    postalCode: business.address.postalCode,
    addressCountry: business.address.country,
  },
  areaServed: business.serviceAreas.map((name) => ({ "@type": "City", name })),
  makesOffer: [
    "Kitchen renovation",
    "Washroom renovation",
    "Interlock and landscaping",
    "Deck construction",
    "Commercial renovation",
  ].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name } })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <a className="va-skip" href="#main">
        Skip to content
      </a>
      <SiteHeader />

      <main className="va-site" id="main">
        <section className="va-hero" id="top" aria-labelledby="hero-title">
          <div className="va-hero-copy">
            <h1 id="hero-title">Kitchens, washrooms, interlock and decks, built properly.</h1>
            <p>
              VA Contracting is a Concord-based crew handling residential and
              commercial renovations across the GTA. Send a few photos and we
              will come out, measure, and give you a clear written estimate.
            </p>
            <div className="va-hero-actions">
              <a className="va-button va-button-primary" href="#quote">
                Request an estimate
              </a>
              <a className="va-button va-button-ghost" href={business.phoneHref}>
                <PhoneIcon />
                Call {business.phoneDisplay}
              </a>
            </div>
          </div>
          <Photo
            alt="Finished kitchen renovation by VA Contracting with a large island and tall windows"
            className="va-hero-photo"
            name="project-kitchen-hero"
            priority
            sizesHint="(min-width: 960px) 58vw, 100vw"
          />
          <ul className="va-hero-facts" aria-label="About VA Contracting">
            <li>
              <strong>Residential and commercial</strong>
              <span>Homes, rental units, and business spaces</span>
            </li>
            <li>
              <strong>Written estimates</strong>
              <span>Scope and price agreed before work starts</span>
            </li>
            <li>
              <strong>Local to the GTA</strong>
              <span>Based at {business.address.street}, Concord</span>
            </li>
          </ul>
        </section>

        <section className="va-section va-services" id="services" aria-labelledby="services-title">
          <header className="va-section-head">
            <h2 id="services-title">What we build</h2>
            <p>
              Most of our work is in four areas. If your project is something
              else, ask anyway. We take on interior updates, basements, and
              repairs too.
            </p>
          </header>

          <div className="va-service-grid">
            {services.map((service) => (
              <article className="va-service" id={service.id} key={service.id}>
                <Photo
                  alt={service.alt}
                  className="va-service-photo"
                  name={service.photo}
                  sizesHint="(min-width: 960px) 46vw, 100vw"
                />
                <div className="va-service-body">
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <ul>
                    {service.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}

            <article className="va-service va-service-commercial" id="commercial">
              <div className="va-service-body">
                <h3>Commercial spaces</h3>
                <p>
                  Tenant improvements, washrooms, finishes, and repairs for
                  offices, shops, and units that need to keep running while the
                  work happens. We plan around your hours and keep the site tidy.
                </p>
                <a className="va-text-link" href="#quote">
                  Ask about a commercial job
                </a>
              </div>
            </article>
          </div>
        </section>

        <section className="va-crew" id="work" aria-labelledby="crew-title">
          <Photo
            alt="The VA Contracting crew on a finished interlock job"
            className="va-crew-photo"
            name="crew"
            sizesHint="(min-width: 960px) 45vw, 100vw"
          />
          <div className="va-crew-copy">
            <h2 id="crew-title">A local crew that stays with the job</h2>
            <p>
              VA Contracting brings the same care to your property that you would
              expect in your own home: tidy work, straight answers, and a team
              focused on the finished result rather than the next job.
            </p>
            <p>
              We are based in Concord, so most of the GTA is a short drive away
              for site visits, follow-ups, and anything that needs a second look
              after we finish.
            </p>
          </div>
        </section>

        <section className="va-section va-process" id="process" aria-labelledby="process-title">
          <header className="va-section-head">
            <h2 id="process-title">How a project runs</h2>
          </header>
          <ol className="va-steps">
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <Testimonials />

        <section className="va-area" id="area" aria-labelledby="area-title">
          <div className="va-area-copy">
            <h2 id="area-title">Working across the GTA</h2>
            <p>
              From our base in Concord we regularly work in these areas and the
              communities around them. Not sure if you are in range? Call and ask.
            </p>
            <ul className="va-area-list">
              {business.serviceAreas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
          </div>
          <div className="va-map">
            <iframe
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
              title={`Map showing VA Contracting at ${fullAddress}`}
            />
            <address>
              <strong>{business.name}</strong>
              <span>{fullAddress}</span>
            </address>
          </div>
        </section>

        <section className="va-quote" id="quote" aria-labelledby="quote-title">
          <div className="va-quote-intro">
            <h2 id="quote-title">Tell us about your project</h2>
            <p>
              A short description and a few photos are usually enough for us to
              get back to you with next steps, or call if you would rather talk
              it through.
            </p>
            <dl className="va-contact-list">
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={business.phoneHref}>{business.phoneDisplay}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </dd>
              </div>
              <div>
                <dt>Office</dt>
                <dd>{fullAddress}</dd>
              </div>
            </dl>
          </div>
          <ContactRequestForm />
        </section>
      </main>

      <footer className="va-footer">
        <div className="va-footer-inner">
          <img src="/images/va-logo-white.png" alt={business.name} width={187} height={160} loading="lazy" />
          <address>
            {fullAddress}
            <br />
            <a href={business.phoneHref}>{business.phoneDisplay}</a>
            <br />
            <a href={`mailto:${business.email}`}>{business.email}</a>
          </address>
          <nav aria-label="Footer">
            <a href="#services">Services</a>
            <a href="#process">How it works</a>
            <a href="#quote">Request an estimate</a>
            <a href="/employee" rel="nofollow">
              Employee login
            </a>
          </nav>
        </div>
        <p className="va-footer-legal">
          © {new Date().getFullYear()} {business.name}. Residential and commercial construction.
        </p>
      </footer>

      <div className="va-mobile-bar" aria-label="Quick contact">
        <a href={business.phoneHref}>
          <PhoneIcon />
          Call
        </a>
        <a href="#quote">Get a quote</a>
      </div>
    </>
  );
}
