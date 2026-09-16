/**
 * Obtiene la fecha y hora exacta actual ajustada a la zona horaria de Venezuela (UTC-4)
 * en formato ISO con offset (-04:00), ideal para columnas timestamptz sin desfases.
 */
export const obtenerFechaHoraExactaVenezuela = (): string => {
  const ahora = new Date();

  // Obtener los componentes de fecha y hora en la zona de Venezuela (UTC-4)
  // Usamos toLocaleString para forzar la lectura correcta en America/Caracas
  const opciones: Intl.DateTimeFormatOptions = {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const partes = new Intl.DateTimeFormat("en-GB", opciones).formatToParts(
    ahora,
  );
  const getParte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value || "00";

  const anio = getParte("year");
  const mes = getParte("month");
  const dia = getParte("day");
  const hora = getParte("hour");
  const minuto = getParte("minute");
  const segundo = getParte("second");

  // Devolvemos en formato ISO con el offset fijo de Venezuela (-04:00)
  return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}-04:00`;
};
