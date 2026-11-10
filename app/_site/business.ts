/**
 * Single source of truth for VA Contracting's public business details.
 * Update these values here and every page, the footer, the structured data,
 * and the quote-request emails pick them up.
 */
export const business = {
  name: "VA Contracting Inc.",
  shortName: "VA Contracting",
  siteUrl: "https://va-contracting.pages.dev",
  phoneDisplay: "(647) 272-8938",
  phoneHref: "tel:+16472728938",
  phoneE164: "+16472728938",
  email: "vacontractinginc73@gmail.com",
  /**
   * Inbox (or FormSubmit alias) that receives website quote requests when the
   * Gmail/Resend secrets are not configured. After the first request, FormSubmit
   * emails an "Activate Form" link to this address. Once activated it also offers
   * a random alias string; paste it here to keep the email address out of the page.
   */
  formRelay: "vacontractinginc73@gmail.com",
  address: {
    street: "9100 Dufferin St",
    city: "Concord",
    region: "ON",
    postalCode: "L4K 5M5",
    country: "CA",
  },
  serviceAreas: [
    "Vaughan",
    "Concord",
    "Toronto",
    "North York",
    "Richmond Hill",
    "Markham",
    "Brampton",
    "Mississauga",
  ],
} as const;

export const fullAddress = `${business.address.street}, ${business.address.city}, ${business.address.region} ${business.address.postalCode}`;

export const projectTypes = [
  "Kitchen renovation",
  "Washroom renovation",
  "Interlock or landscaping",
  "Deck",
  "Basement or interior",
  "Commercial space",
  "Repair or something else",
] as const;
