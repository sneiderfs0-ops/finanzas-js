import { Redirect } from "expo-router";

export default function Index() {
  // Puedes redirigir por defecto al flujo de autenticación o a las pestañas
  return <Redirect href="/(auth)/sign-in" />;
}
