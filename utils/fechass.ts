export const formatearFechaLocal = (
  fechaStr: string | undefined | null,
): string => {
  if (!fechaStr) return "N/A";
  const soloFecha = fechaStr.split("T")[0];
  const [anio, mes, dia] = soloFecha.split("-");

  if (!anio || !mes || !dia) return fechaStr;

  return `${parseInt(dia)}/${parseInt(mes)}/${anio}`;
};
