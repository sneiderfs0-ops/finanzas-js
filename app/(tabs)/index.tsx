import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../supabase";

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null); // Guardará los datos del empleado/secretaria/admin logueado

  const [resumen, setResumen] = useState({
    prestadoHoy: 0,
    recaudadoHoy: 0,
    activos: 0,
  });

  const [totalCajasUSD, setTotalCajasUSD] = useState(0);
  const [totalCajasCOP, setTotalCajasCOP] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalEmpleados, setTotalEmpleados] = useState(0);
  const [totalGastosNomina, setTotalGastosNomina] = useState({
    USD: 0,
    COP: 0,
  });
  const [totalCobros, setTotalCobros] = useState({ USD: 0, COP: 0 });
  const [gananciasNeta, setGananciasNeta] = useState({ USD: 0, COP: 0 });

  useEffect(() => {
    verificarSesionYDatos();
  }, []);

  const verificarSesionYDatos = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !session.user?.email) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const emailUser = session.user.email.trim().toLowerCase();

      // 1. Verificar en la tabla de ADMINISTRADORES
      let { data: adminData } = await supabase
        .from("administradores")
        .select("*")
        .eq("correo", emailUser)
        .maybeSingle();

      if (adminData) {
        setUserRole("administrador");
        setUserData(adminData);
        // El administrador carga todo
        await Promise.all([
          cargarResumen(),
          cargarCajasYBancos(),
          cargarClientesYEmpleados(),
          cargarGastosYNomina(),
          cargarCobrosYGanancias(),
        ]);
        setLoading(false);
        return;
      }

      // 2. Verificar en la tabla de SECRETARIA
      let { data: secretariaData } = await supabase
        .from("secretaria")
        .select("*")
        .eq("correo", emailUser)
        .maybeSingle();

      if (secretariaData) {
        setUserRole("secretaria");
        setUserData(secretariaData);
        // La secretaria solo ve el resumen general del día (gráfico y totales del día)
        await cargarResumen();
        setLoading(false);
        return;
      }

      // 3. Verificar en la tabla de EMPLEADOS
      let { data: empleadoData } = await supabase
        .from("empleados")
        .select("*")
        .eq("correo", emailUser)
        .maybeSingle();

      if (empleadoData) {
        setUserRole("empleado");
        setUserData(empleadoData);
        // El empleado solo ve su propio resumen del día basado en su cédula o ID
        await cargarResumenPersonal(empleadoData.cedula);
        setLoading(false);
        return;
      }

      // Si no encaja en ninguna tabla, cerrar sesión por seguridad
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
    } catch (err) {
      console.error("Error al verificar rol y sesión:", err);
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  };

  // Carga general para Administradores
  const cargarResumen = async () => {
    const hoy = new Date().toISOString().split("T")[0];

    const { data: prestamos } = await supabase
      .from("prestamos")
      .select("monto_total, fecha_prestamo")
      .gte("fecha_prestamo", `${hoy}T00:00:00`);

    const totalPrestado =
      prestamos?.reduce((acc, curr) => acc + Number(curr.monto_total), 0) || 0;

    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto_pagado")
      .gte("fecha_pago", `${hoy}T00:00:00`);

    const totalRecaudado =
      pagos?.reduce((acc, curr) => acc + Number(curr.monto_pagado), 0) || 0;

    setResumen({
      prestadoHoy: totalPrestado,
      recaudadoHoy: totalRecaudado,
      activos: prestamos?.length || 0,
    });
  };

  // Carga exclusiva y personal para Empleados (filtrado por su cédula)
  const cargarResumenPersonal = async (cedulaEmpleado: string) => {
    const hoy = new Date().toISOString().split("T")[0];

    // Nota: Asegúrate de que tu tabla 'prestamos' y 'pagos' tengan una columna como 'cedula_empleado' o 'usuario_cedula'
    // que relacione quién hizo el préstamo o cobro. Ajusta el nombre de la columna si es distinto (ej. 'empleado_cedula').
    const { data: prestamos } = await supabase
      .from("prestamos")
      .select("monto_total, fecha_prestamo")
      .eq("empleado_cedula", cedulaEmpleado)
      .gte("fecha_prestamo", `${hoy}T00:00:00`);

    const totalPrestado =
      prestamos?.reduce((acc, curr) => acc + Number(curr.monto_total), 0) || 0;

    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto_pagado")
      .eq("empleado_cedula", cedulaEmpleado)
      .gte("fecha_pago", `${hoy}T00:00:00`);

    const totalRecaudado =
      pagos?.reduce((acc, curr) => acc + Number(curr.monto_pagado), 0) || 0;

    setResumen({
      prestadoHoy: totalPrestado,
      recaudadoHoy: totalRecaudado,
      activos: prestamos?.length || 0,
    });
  };

  const cargarCajasYBancos = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("saldo_actual, moneda");
    let usd = 0;
    let cop = 0;
    data?.forEach((item) => {
      const saldo = Number(item.saldo_actual || 0);
      if (item.moneda === "USD") usd += saldo;
      if (item.moneda === "COP") cop += saldo;
    });
    setTotalCajasUSD(usd);
    setTotalCajasCOP(cop);
  };

  const cargarClientesYEmpleados = async () => {
    const { count: countClientes } = await supabase
      .from("clientes")
      .select("*", { count: "exact", head: true });
    setTotalClientes(countClientes || 0);

    const { count: countEmpleados } = await supabase
      .from("empleados")
      .select("*", { count: "exact", head: true });
    setTotalEmpleados(countEmpleados || 0);
  };

  const cargarGastosYNomina = async () => {
    const { data: gastos } = await supabase
      .from("gastos")
      .select("monto, moneda");
    let usd = 0;
    let cop = 0;
    gastos?.forEach((item) => {
      if (item.moneda === "USD") usd += Number(item.monto);
      if (item.moneda === "COP") cop += Number(item.monto);
    });
    setTotalGastosNomina({ USD: usd, COP: cop });
  };

  const cargarCobrosYGanancias = async () => {
    const { data: pagos } = await supabase
      .from("pagos")
      .select("monto_pagado, moneda");
    let cobrosUSD = 0;
    let cobrosCOP = 0;
    pagos?.forEach((p) => {
      if (p.moneda === "USD") cobrosUSD += Number(p.monto_pagado);
      if (p.moneda === "COP") cobrosCOP += Number(p.monto_pagado);
    });
    setTotalCobros({ USD: cobrosUSD, COP: cobrosCOP });

    const { data: cierres } = await supabase
      .from("cierres_caja")
      .select("ganancia_neta, moneda");
    let gananciaUSD = 0;
    let gananciaCOP = 0;
    cierres?.forEach((c) => {
      if (c.moneda === "USD") gananciaUSD += Number(c.ganancia_neta);
      if (c.moneda === "COP") gananciaCOP += Number(c.ganancia_neta);
    });
    setGananciasNeta({ USD: gananciaUSD, COP: gananciaCOP });
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={{ color: "#94a3b8", marginTop: 10 }}>
          Cargando panel...
        </Text>
      </View>
    );
  }

  const totalGeneral = resumen.prestadoHoy + resumen.recaudadoHoy;
  const porcentajePrestado =
    totalGeneral > 0 ? (resumen.prestadoHoy / totalGeneral) * 100 : 50;
  const porcentajeRecaudado =
    totalGeneral > 0 ? (resumen.recaudadoHoy / totalGeneral) * 100 : 50;

  return (
    <ScrollView
      style={styles.mainContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.wrapper}>
        <Text style={styles.headerTitle}>
          📊 Panel de Control {userRole ? `(${userRole.toUpperCase()})` : ""}
        </Text>
        <Text style={styles.subtitle}>
          {userRole === "empleado"
            ? `Tus estadísticas personales de hoy - ${userData?.nombres || ""}`
            : userRole === "secretaria"
              ? "Resumen operativo general de caja y cobros del día"
              : "Resumen financiero y accesos rápidos globales"}
        </Text>

        {/* Tarjetas de Resumen Rápido (Visible para Admin, Secretaria y Empleado con sus respectivos datos) */}
        <View style={styles.cardGrid}>
          <View style={[styles.statCard, styles.cardPrestado]}>
            <Text style={styles.cardTitle}>
              {userRole === "empleado"
                ? "Tus Préstamos Hoy"
                : "Total Prestado Hoy"}
            </Text>
            <Text style={[styles.cardValue, { color: "#38bdf8" }]}>
              ${resumen.prestadoHoy.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statCard, styles.cardRecaudado]}>
            <Text style={styles.cardTitle}>
              {userRole === "empleado"
                ? "Tus Cobros Hoy"
                : "Total Recaudado Hoy"}
            </Text>
            <Text style={[styles.cardValue, { color: "#4ade80" }]}>
              ${resumen.recaudadoHoy.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Gráfico / Flujo del Día (Visible para Administrador, Secretaria y Empleado) */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            📈{" "}
            {userRole === "empleado"
              ? "Tu Flujo Personal de Hoy"
              : "Flujo General de Dinero de Hoy"}
          </Text>

          <View style={styles.donutContainer}>
            <View style={styles.donutCircle}>
              <Text style={styles.donutCenterText}>Total</Text>
              <Text style={styles.donutCenterValue}>
                ${totalGeneral.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: "#38bdf8" }]}
              />
              <Text style={styles.legendText}>
                Prestado ({porcentajePrestado.toFixed(0)}%)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: "#4ade80" }]}
              />
              <Text style={styles.legendText}>
                Recaudado ({porcentajeRecaudado.toFixed(0)}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Módulos y Saldos - EXCLUSIVO PARA ADMINISTRADORES */}
        {userRole === "administrador" && (
          <>
            <Text style={styles.sectionTitle}>Módulos y Saldos</Text>

            <View style={styles.menuGrid}>
              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#a855f7" }]}
                onPress={() => router.push("/(tabs)/clientes")}
              >
                <Text style={styles.menuEmoji}>👤</Text>
                <Text style={styles.menuTitle}>Clientes</Text>
                <Text style={styles.saldoText}>
                  Registrados:{" "}
                  <Text style={styles.boldSaldo}>{totalClientes}</Text>
                </Text>
                <Text style={styles.menuDesc}>
                  Base de datos de prestatarios
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#f43f5e" }]}
                onPress={() => router.push("/(tabs)/detalle-prestamo")}
              >
                <Text style={styles.menuEmoji}>💸</Text>
                <Text style={styles.menuTitle}>Cobros</Text>
                <Text style={styles.saldoText}>
                  USD:{" "}
                  <Text style={styles.boldSaldo}>
                    ${totalCobros.USD.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.saldoText}>
                  COP:{" "}
                  <Text style={styles.boldSaldo}>
                    ${totalCobros.COP.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.menuDesc}>Gestionar abonos y cuotas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#4ade80" }]}
                onPress={() => router.push("/(tabs)/caja")}
              >
                <Text style={styles.menuEmoji}>💰</Text>
                <Text style={styles.menuTitle}>Caja / Bancos</Text>
                <View style={styles.saldosContainer}>
                  <Text style={styles.saldoText}>
                    USD:{" "}
                    <Text style={styles.boldSaldo}>
                      ${totalCajasUSD.toLocaleString()}
                    </Text>
                  </Text>
                  <Text style={styles.saldoText}>
                    COP:{" "}
                    <Text style={styles.boldSaldo}>
                      ${totalCajasCOP.toLocaleString()}
                    </Text>
                  </Text>
                </View>
                <Text style={styles.menuDesc}>
                  Saldos totales en efectivo y bancos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#fbbf24" }]}
                onPress={() => router.push("/(tabs)/gastos")}
              >
                <Text style={styles.menuEmoji}>📑</Text>
                <Text style={styles.menuTitle}>Gastos & Nómina</Text>
                <Text style={styles.saldoText}>
                  USD:{" "}
                  <Text style={styles.boldSaldo}>
                    ${totalGastosNomina.USD.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.saldoText}>
                  COP:{" "}
                  <Text style={styles.boldSaldo}>
                    ${totalGastosNomina.COP.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.menuDesc}>
                  Pagos de empleados y egresos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#6366f1" }]}
                onPress={() => router.push("/(tabs)/empleados")}
              >
                <Text style={styles.menuEmoji}>👥</Text>
                <Text style={styles.menuTitle}>Empleados</Text>
                <Text style={styles.saldoText}>
                  Activos:{" "}
                  <Text style={styles.boldSaldo}>{totalEmpleados}</Text>
                </Text>
                <Text style={styles.menuDesc}>Autorizaciones y personal</Text>
              </TouchableOpacity>

              <View style={[styles.menuCard, { borderLeftColor: "#10b981" }]}>
                <Text style={styles.menuEmoji}>📈</Text>
                <Text style={styles.menuTitle}>Ganancias</Text>
                <Text style={styles.saldoText}>
                  USD:{" "}
                  <Text style={styles.boldGanancia}>
                    ${gananciasNeta.USD.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.saldoText}>
                  COP:{" "}
                  <Text style={styles.boldGanancia}>
                    ${gananciasNeta.COP.toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.menuDesc}>
                  Utilidades netas registradas
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  wrapper: {
    width: "100%",
    maxWidth: 800,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 24,
  },
  cardGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 5,
  },
  cardPrestado: {},
  cardRecaudado: {},
  cardTitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
    fontWeight: "600",
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  chartCard: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 5,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 16,
  },
  donutContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 14,
    borderColor: "#38bdf8",
    borderLeftColor: "#4ade80",
    borderBottomColor: "#f43f5e",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  donutCircle: {
    justifyContent: "center",
    alignItems: "center",
  },
  donutCenterText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  donutCenterValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  legendContainer: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "center",
    width: "100%",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 13,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  menuCard: {
    width: "48%",
    backgroundColor: "#1e293b",
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 4,
  },
  menuEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 6,
  },
  menuDesc: {
    fontSize: 11,
    color: "#94a3b8",
    lineLink: 15,
    marginTop: 4,
  },
  saldosContainer: {
    marginTop: 4,
  },
  saldoText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  boldSaldo: {
    fontWeight: "bold",
    color: "#4ade80",
  },
  boldGanancia: {
    fontWeight: "bold",
    color: "#38bdf8",
  },
});
