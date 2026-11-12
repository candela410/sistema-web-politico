// Texto para comparar sin distinguir mayúsculas ni acentos
// ("Administración" = "administracion"). Lo usan los buscadores de los listados.
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
