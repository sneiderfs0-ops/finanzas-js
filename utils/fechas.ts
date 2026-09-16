/**
 * Obtiene la fecha y hora exacta actual ajustada a la zona horaria de Venezuela (UTC-4)
 * en formato ISO con offset (-04:00), ideal para columnas timestamptz sin desfases.
 */
export const obtenerFechaHoraExactaVenezuela = (): string => {
  const ahora = new Date();

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

  return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}-04:00`;
};

/**
 * Recibe una fecha de Supabase (como fecha_prestamo o created_at) y la formatea
 * para mostrarla en la interfaz con fecha, hora y formato de 12 horas (a. m. / p. m.).
 */
export const formatearFechaVenezuela = (fechaStr: string | null): string => {
  if (!fechaStr) return "N/A";
  try {
    const fechaObj = new Date(fechaStr.replace("Z", ""));

    return fechaObj.toLocaleString("es-VE", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // Formato a. m. / p. m. igual que tus gastos
    });
  } catch (e) {
    return fechaStr;
  }
};
