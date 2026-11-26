/** Public contact details supplied and approved by the project owner. */
export const contactInformation = {
  email: "mangauniverse05@gmail.com",
  phone: "0369 210 172",
  phoneHref: "tel:+84369210172",
  facebook: "https://www.facebook.com/profile.php?id=61596943022089",
  coordinates: "9.1859680957964,105.16684055328",
} as const;
export const contactMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactInformation.coordinates)}`;
export const contactMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(contactInformation.coordinates)}&z=16&output=embed`;
