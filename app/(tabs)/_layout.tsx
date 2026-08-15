import React, { useState, useEffect } from "react";
import { SymbolView } from "expo-symbols";
import { Link, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import {
  Pressable,
  Platform,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";

import { colors, globalStyles } from "@/constants/globalStyles";
import { supabase } from "../../supabase";

function CustomDrawerContent(props: any) {
  const router = useRouter();
  const [canAccessPrivileged, setCanAccessPrivileged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    verificarPermisosUsuario();
  }, []);

  const verificarPermisosUsuario = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !session.user?.email) return;

      const email = session.user.email.trim().toLowerCase();

      // Verificar si es administrador
      const { data: adminData } = await supabase
        .from("administradores")
        .select("*")
        .eq("correo", email)
        .maybeSingle();

      if (adminData) {
        setIsAdmin(true);
        setCanAccessPrivileged(true);
        return;
      }

      // Verificar si es secretaria
      const { data: secretariaData } = await supabase
        .from("secretaria")
        .select("*")
        .eq("correo", email)
        .eq("aprobado", "aprobado")
        .maybeSingle();

      if (secretariaData) {
        setCanAccessPrivileged(true);
      }
    } catch (error) {
      console.error("Error al verificar permisos en el menú:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.log("Error al cerrar sesión:", error.message);
      }
      router.replace("/(auth)/sign-in");
    } catch (err) {
      console.log("Excepción al cerrar sesión:", err);
    }
  };

  return (
    <ScrollView contentContainerStyle={localStyles.drawerContainer}>
      <View style={localStyles.drawerHeader}>
        <Text style={localStyles.drawerTitle}>💰 Sistema de Préstamos</Text>
        <Text style={localStyles.drawerSubtitle}>Panel de Control</Text>
      </View>

      <View style={localStyles.navLinks}>
        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={localStyles.navText}>🏠 Inicio</Text>
        </Pressable>

        {isAdmin && (
          <Pressable
            style={localStyles.navItem}
            onPress={() => router.push("/(tabs)/caja")}
          >
            <Text style={localStyles.navText}>📊 Balance General</Text>
          </Pressable>
        )}
        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/rutas")}
        >
          <Text style={localStyles.navText}>🗺️ Rutas de Cobro</Text>
        </Pressable>

        {/* 👇 NUEVO ENLACE: Lista y Reporte de Rutas */}
        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/listas-rutas")}
        >
          <Text style={localStyles.navText}>📋 Lista de Rutas</Text>
        </Pressable>

        {canAccessPrivileged && (
          <Pressable
            style={localStyles.navItem}
            onPress={() => router.push("/(tabs)/empleados")}
          >
            <Text style={localStyles.navText}>👥 Empleados</Text>
          </Pressable>
        )}

        {/* Solo se muestra a administradores, oculto para empleados y secretarias */}
        {isAdmin && (
          <Pressable
            style={localStyles.navItem}
            onPress={() => router.push("/(tabs)/lista-prestamos")}
          >
            <Text style={localStyles.navText}>📋 Lista de Préstamos</Text>
          </Pressable>
        )}

        {canAccessPrivileged && (
          <Pressable
            style={localStyles.navItem}
            onPress={() => router.push("/(tabs)/lista-pagos")}
          >
            <Text style={localStyles.navText}>📋 Lista de Cobros Semanal</Text>
          </Pressable>
        )}

        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/clientes")}
        >
          <Text style={localStyles.navText}>📇 Clientes</Text>
        </Pressable>

        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/crear-clientes")}
        >
          <Text style={localStyles.navText}>📝 Registrar Clientes</Text>
        </Pressable>

        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/crear-prestamo")}
        >
          <Text style={localStyles.navText}>📝 Nuevo Préstamo</Text>
        </Pressable>

        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/pagos")}
        >
          <Text style={localStyles.navText}>📝 Registrar pago de clientes</Text>
        </Pressable>

        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/gastos")}
        >
          <Text style={localStyles.navText}>📉 Gastos</Text>
        </Pressable>
      </View>

      <View style={localStyles.drawerFooter}>
        <Pressable
          style={localStyles.navItem}
          onPress={() => router.push("/(tabs)/informacion-perfil")}
        >
          <Text style={localStyles.navText}>Configuración</Text>
        </Pressable>
        <Pressable style={localStyles.logoutBtn} onPress={handleSignOut}>
          <Text style={localStyles.logoutBtnText}>🚪 Cerrar Sesión</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function NotificacionesEmpleadosHeader() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [contador, setContador] = useState(0);

  useEffect(() => {
    verificarAdminYCargarPendientes();
  }, []);

  const verificarAdminYCargarPendientes = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || !session.user?.email) return;

      const email = session.user.email.trim().toLowerCase();

      const { data: adminData } = await supabase
        .from("administradores")
        .select("*")
        .eq("correo", email)
        .maybeSingle();

      if (adminData) {
        setIsAdmin(true);
        await cargarSolicitudesPendientes();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error al verificar permisos de administrador:", error);
    }
  };

  const cargarSolicitudesPendientes = async () => {
    try {
      const { data: empPendientes, error: errEmp } = await supabase
        .from("empleados")
        .select("*")
        .eq("aprobado", "pendiente");

      if (errEmp)
        console.error("Error cargando empleados pendientes:", errEmp.message);

      const { data: secPendientes, error: errSec } = await supabase
        .from("secretaria")
        .select("*")
        .eq("aprobado", "pendiente");

      if (errSec)
        console.error("Error cargando secretarias pendientes:", errSec.message);

      const listaEmpleados = (empPendientes || []).map((item) => ({
        ...item,
        tablaDestino: "empleados",
      }));
      const listaSecretarias = (secPendientes || []).map((item) => ({
        ...item,
        tablaDestino: "secretaria",
      }));

      const combinados = [...listaEmpleados, ...listaSecretarias];
      setPendientes(combinados);
      setContador(combinados.length);
    } catch (error) {
      console.error("Error al cargar solicitudes pendientes:", error);
    }
  };

  const handlePressCampana = () => {
    if (!isAdmin) {
      Alert.alert(
        "Acceso denegado",
        "Solo el administrador puede gestionar las solicitudes.",
      );
      return;
    }
    cargarSolicitudesPendientes();
    setModalVisible(true);
  };

  const gestionarSolicitud = async (
    idRegistro: string,
    tablaDestino: string,
    accion: "aprobado" | "eliminar",
  ) => {
    try {
      if (accion === "eliminar") {
        const { error } = await supabase
          .from(tablaDestino)
          .delete()
          .eq("id", idRegistro);

        if (error) throw error;
        Alert.alert(
          "Aviso",
          "La solicitud fue denegada y el registro se eliminó correctamente.",
        );
      } else {
        const { error } = await supabase
          .from(tablaDestino)
          .update({ aprobado: "aprobado" })
          .eq("id", idRegistro);

        if (error) throw error;
        Alert.alert("Éxito", "Usuario aprobado correctamente en el sistema.");
      }

      await cargarSolicitudesPendientes();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message ||
          "No se pudo procesar la solicitud en la base de datos.",
      );
    }
  };

  return (
    <>
      {isAdmin && (
        <Pressable onPress={handlePressCampana} style={localStyles.bellButton}>
          <SymbolView
            name={Platform.OS === "ios" ? "bell.fill" : "notifications"}
            size={26}
            tintColor={colors.textPrimary}
          />

          {contador > 0 && (
            <View style={localStyles.badge}>
              <Text style={localStyles.badgeText}>{contador}</Text>
            </View>
          )}
        </Pressable>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={globalStyles.modalOverlay}>
          <View
            style={[
              globalStyles.modalContent,
              localStyles.modalResponsiveContainer,
            ]}
          >
            <View style={localStyles.modalHeaderTitleContainer}>
              <SymbolView
                name={Platform.OS === "ios" ? "bell.fill" : "notifications"}
                size={24}
                tintColor={colors.textPrimary}
              />
              <Text style={globalStyles.modalTitle}>
                🔔 Solicitudes Pendientes
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingVertical: 10 }}
              style={localStyles.modalScrollArea}
              showsVerticalScrollIndicator={true}
            >
              {pendientes.length === 0 ? (
                <Text style={localStyles.emptyText}>
                  No hay solicitudes pendientes en este momento.
                </Text>
              ) : (
                pendientes.map((item, index) => (
                  <View
                    key={item.id || item.correo || index}
                    style={localStyles.cardItem}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.cardName}>
                        {item.nombres} {item.apellidos}
                      </Text>
                      <Text style={localStyles.cardEmail} numberOfLines={2}>
                        {item.correo}
                      </Text>
                      <Text style={localStyles.cardRole}>
                        Rol: {item.rol ? item.rol.toUpperCase() : "EMPLEADO"}
                      </Text>
                    </View>
                    <View style={localStyles.actionButtons}>
                      <TouchableOpacity
                        style={localStyles.btnAprobar}
                        onPress={() =>
                          gestionarSolicitud(
                            item.id,
                            item.tablaDestino,
                            "aprobado",
                          )
                        }
                      >
                        <Text style={localStyles.btnText}>Aprobar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={localStyles.btnRechazar}
                        onPress={() =>
                          gestionarSolicitud(
                            item.id,
                            item.tablaDestino,
                            "eliminar",
                          )
                        }
                      >
                        <Text style={localStyles.btnText}>Denegar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={localStyles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={localStyles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function TabLayout() {
  const router = useRouter();

  const renderHeaderRight = () => (
    <View style={localStyles.headerRightContainer}>
      <NotificacionesEmpleadosHeader />

      <Pressable
        onPress={() => router.push("/modal")}
        style={localStyles.iconButton}
      >
        {({ pressed }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: pressed ? 0.5 : 1,
            }}
          >
            <SymbolView
              name={
                Platform.OS === "ios" ? "rectangle.stack.badge.plus" : "copy"
              }
              size={20}
              tintColor={colors.textPrimary}
            />
            <SymbolView
              name={Platform.OS === "ios" ? "info.circle.fill" : "info"}
              size={20}
              tintColor={colors.textPrimary}
            />
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
              Información
            </Text>
          </View>
        )}
      </Pressable>

      <Link href="/modal" asChild>
        <Pressable style={localStyles.iconButton}>
          {({ pressed }) => (
            <SymbolView
              name={Platform.OS === "ios" ? "info.circle" : "info"}
              size={22}
              tintColor={colors.textPrimary}
              style={{ opacity: pressed ? 0.5 : 1 }}
            />
          )}
        </Pressable>
      </Link>
    </View>
  );

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: colors.textPrimary,
        headerStyle: {
          backgroundColor: colors.background,
        },
        drawerStyle: {
          backgroundColor: colors.background,
          width: 280,
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Inicio",
          headerTitle: "",
          headerRight: renderHeaderRight,
        }}
      />
      <Drawer.Screen
        name="rutas"
        options={{ title: "Gestión de Rutas", headerRight: renderHeaderRight }}
      />
      {/* 👇 NUEVA PANTALLA REGISTRADA EN EL DRAWER */}
      <Drawer.Screen
        name="listas-rutas"
        options={{ title: "Lista de Rutas", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="clientes"
        options={{ title: "Clientes", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="crear-clientes"
        options={{
          title: "Registrar Clientes",
          headerRight: renderHeaderRight,
        }}
      />
      <Drawer.Screen
        name="crear-prestamo"
        options={{ title: "Nuevo Préstamo", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="lista-prestamos"
        options={{
          title: "Lista de Préstamos",
          headerRight: renderHeaderRight,
        }}
      />
      <Drawer.Screen
        name="lista-pagos"
        options={{
          title: "Lista de Cobros Semanales",
          headerRight: renderHeaderRight,
        }}
      />
      <Drawer.Screen
        name="gastos"
        options={{ title: "Gastos", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="caja"
        options={{ title: "Balance General", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="empleados"
        options={{ title: "Empleados", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="pagos"
        options={{ title: "Pagos de clientes", headerRight: renderHeaderRight }}
      />
      <Drawer.Screen
        name="informacion-perfil"
        options={{
          title: "Configuración del perfil",
          headerRight: renderHeaderRight,
        }}
      />
    </Drawer>
  );
}

const localStyles = StyleSheet.create({
  drawerContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: 20,
    backgroundColor: colors.background,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  drawerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  navLinks: {
    paddingHorizontal: 15,
    flex: 1,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  navText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  drawerFooter: {
    paddingHorizontal: 16,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.accentRed,
    alignItems: "center",
  },
  logoutBtnText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 13,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  bellButton: {
    position: "relative",
    padding: 10,
  },
  badge: {
    position: "absolute",
    right: -4,
    top: -2,
    backgroundColor: colors.accentRed,
    borderRadius: 12,
    minWidth: 25,
    height: 25,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
  modalHeaderTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    gap: 8,
  },
  modalResponsiveContainer: {
    width: "92%",
    maxWidth: 480,
    maxHeight: "85%",
    paddingHorizontal: 14,
  },
  modalScrollArea: {
    flexShrink: 1,
  },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginVertical: 20,
  },
  cardItem: {
    backgroundColor: colors.cardBackground,
    padding: 20,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: "column",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardName: {
    fontWeight: "bold",
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardEmail: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 3,
  },
  cardRole: {
    fontSize: 15,
    color: colors.accentBlue,
    marginTop: 8,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  btnAprobar: {
    backgroundColor: colors.accentGreen,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  btnRechazar: {
    backgroundColor: colors.accentRed,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  btnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  closeButton: {
    backgroundColor: colors.border,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 1,
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
});
