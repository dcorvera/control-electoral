// src/lib/parseClient.ts
const Parse = typeof window !== 'undefined' ? (window as any).Parse : null;

if (Parse) {
  Parse.initialize("4949yrVsfdMJ4qNDhnuv8V3bs457Wxs", "");
  Parse.serverURL = "https://subscripciones.aplidea.com.bo/api";
}

export default Parse;