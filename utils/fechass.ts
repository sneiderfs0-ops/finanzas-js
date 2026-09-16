export const formatearFechaLocal = (
  fechaStr: string | undefined | null,
): string => {
  if (!fechaStr) return "N/A";

  // Creamos el objeto Date a partir del string (compatible con formato ISO o SQL)
  const fecha = new Date(fechaStr);

  // Validamos si la fecha es válida
  if (isNaN(fecha.getTime())) return fechaStr;

  // Usamos Intl.DateTimeFormat para formatearlo automáticamente al formato local deseado
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true, // Esto activa el formato de 12 horas con a. m. / p. m.
  }).format(fecha);
};
