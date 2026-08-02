import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validación opcional para avisarte en consola si faltan las llaves
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Faltan las variables de entorno de Supabase. Recuerda reiniciar con 'npx expo start -c'",
  );
}

// Usamos el almacenamiento condicional correcto según la plataforma
const customStorage = Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_ANON_KEY || "",
  {
    auth: {
      storage: customStorage, // <--- Aquí usamos la variable correcta
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
