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
  const [userData, setUserData] = useState<any>(null);

  const [resumen, setResumen] = useState({
    prestadoHoy: { USD: 0, COP: 0 },
    recaudadoHoy: { USD: 0, COP: 0 },
    gastosHoy: { USD: 0, COP: 0 },
    totalEntregar: { USD: 0, COP: 0 },
    excedenteCaja: { USD: 0, COP: 0 },
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
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session || !session.user?.email) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const emailUser = session.user.email.trim().toLowerCase();

      // 1. Verificar en ADMINISTRADORES
      try {
        const { data: adminData } = await supabase
          .from("administradores")
          .select("*")
          .eq("correo", emailUser)
          .maybeSingle();

        if (adminData) {
          setUserRole("administrador");
          setUserData(adminData);
          await Promise.all([
            cargarResumenGeneral(),
            cargarCajasYBancos(),
            cargarClientesYEmpleados(),
            cargarGastosYNomina(),
            cargarCobrosYGanancias(),
          ]);

          const channelAdmin = supabase.channel("rt-admin-global");

          channelAdmin
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "prestamos" },
              () => {
                cargarResumenGeneral();
                cargarCajasYBancos();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "gastos" },
              () => {
                cargarResumenGeneral();
                cargarGastosYNomina();
                cargarCajasYBancos();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "pagos" },
              () => {
                cargarResumenGeneral();
                cargarCobrosYGanancias();
                cargarCajasYBancos();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "empleados" },
              () => {
                cargarClientesYEmpleados();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "secretaria" },
              () => {
                cargarClientesYEmpleados();
              },
            )
            .subscribe();

          setLoading(false);
          return () => {
            supabase.removeChannel(channelAdmin);
          };
        }
      } catch (e) {
        console.log("No es administrador o falló la consulta:", e);
      }

      // 2. Verificar en SECRETARIA
      try {
        const { data: secretariaData } = await supabase
          .from("secretaria")
          .select("*")
          .eq("correo", emailUser)
          .maybeSingle();

        if (secretariaData) {
          setUserRole("secretaria");
          setUserData(secretariaData);
          await Promise.all([cargarResumenGeneral(), cargarCajasYBancos()]);

          const channelSecretaria = supabase.channel("rt-secretaria-global");

          channelSecretaria
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "prestamos" },
              () => {
                cargarResumenGeneral();
                cargarCajasYBancos();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "pagos" },
              () => {
                cargarResumenGeneral();
                cargarCajasYBancos();
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "gastos" },
              () => {
                cargarResumenGeneral();
                cargarCajasYBancos();
              },
            )
            .subscribe();

          setLoading(false);
          return () => {
            supabase.removeChannel(channelSecretaria);
          };
        }
      } catch (e) {
        console.log("No es secretaria o falló la consulta:", e);
      }

      // 3. Verificar en EMPLEADOS
      try {
        const { data: empleadoData } = await supabase
          .from("empleados")
          .select("*")
          .eq("correo", emailUser)
          .maybeSingle();

        if (empleadoData && empleadoData.cedula) {
          setUserRole("empleado");
          setUserData(empleadoData);
          await cargarResumenPersonal(empleadoData.cedula);

          const channelEmpleado = supabase.channel(
            `rt-empleado-${empleadoData.cedula}`,
          );

          channelEmpleado
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "prestamos" },
              () => cargarResumenPersonal(empleadoData.cedula),
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "pagos" },
              () => cargarResumenPersonal(empleadoData.cedula),
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "gastos" },
              () => cargarResumenPersonal(empleadoData.cedula),
            )
            .on(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "empleados" },
              (payload) => {
                if (payload.new.cedula === empleadoData.cedula) {
                  setUserData(payload.new);
                }
              },
            )
            .subscribe();

          setLoading(false);
          return () => {
            supabase.removeChannel(channelEmpleado);
          };
        }
      } catch (e) {
        console.log("No es empleado o falló la consulta:", e);
      }

      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
    } catch (err) {
      console.error("Error crítico general al verificar sesión:", err);
      router.replace("/(auth)/sign-in");
    } finally {
      setLoading(false);
    }
  };

  const cargarResumenGeneral = async () => {
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const mañana = new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0];

      const { data: prestamos } = await supabase
        .from("prestamos")
        .select("monto_total, moneda, fecha_prestamo")
        .gte("fecha_prestamo", `${hoy} 00:00:00`)
        .lt("fecha_prestamo", `${mañana} 00:00:00`);

      let prestadoUSD = 0;
      let prestadoCOP = 0;
      prestamos?.forEach((item) => {
        const monto = Number(item.monto_total || 0);
        if (item.moneda === "USD") prestadoUSD += monto;
        if (item.moneda === "COP") prestadoCOP += monto;
      });

      const { data: pagos } = await supabase
        .from("pagos")
        .select("monto_pagado, moneda, fecha_pago")
        .gte("fecha_pago", `${hoy} 00:00:00`)
        .lt("fecha_pago", `${mañana} 00:00:00`);

      let recaudadoUSD = 0;
      let recaudadoCOP = 0;
      pagos?.forEach((item) => {
        const monto = Number(item.monto_pagado || 0);
        if (item.moneda === "USD") recaudadoUSD += monto;
        if (item.moneda === "COP") recaudadoCOP += monto;
      });

      const { data: gastos } = await supabase
        .from("gastos")
        .select("monto, moneda, fecha_gasto")
        .gte("fecha_gasto", `${hoy} 00:00:00`)
        .lt("fecha_gasto", `${mañana} 00:00:00`);

      let gastosUSD = 0;
      let gastosCOP = 0;
      gastos?.forEach((item) => {
        const monto = Number(item.monto || 0);
        if (item.moneda === "USD") gastosUSD += monto;
        if (item.moneda === "COP") gastosCOP += monto;
      });

      const netoUSD = recaudadoUSD - gastosUSD - prestadoUSD;
      const netoCOP = recaudadoCOP - gastosCOP - prestadoCOP;

      setResumen({
        prestadoHoy: { USD: prestadoUSD, COP: prestadoCOP },
        recaudadoHoy: { USD: recaudadoUSD, COP: recaudadoCOP },
        gastosHoy: { USD: gastosUSD, COP: gastosCOP },
        totalEntregar: {
          USD: Math.max(0, netoUSD),
          COP: Math.max(0, netoCOP),
        },
        excedenteCaja: {
          USD: netoUSD < 0 ? Math.abs(netoUSD) : 0,
          COP: netoCOP < 0 ? Math.abs(netoCOP) : 0,
        },
        activos: prestamos?.length || 0,
      });
    } catch (e) {
      console.log("Error en cargarResumenGeneral:", e);
    }
  };

  const cargarResumenPersonal = async (cedulaEmpleado: string) => {
    try {
      const hoy = new Date().toISOString().split("T")[0];
      const mañana = new Date(Date.now() + 86400000)
        .toISOString()
        .split("T")[0];

      const { data: prestamos } = await supabase
        .from("prestamos")
        .select("monto_total, moneda, fecha_prestamo")
        .eq("registrado_por_cedula", cedulaEmpleado)
        .gte("fecha_prestamo", `${hoy} 00:00:00`)
        .lt("fecha_prestamo", `${mañana} 00:00:00`);

      let prestadoUSD = 0;
      let prestadoCOP = 0;
      prestamos?.forEach((item) => {
        const monto = Number(item.monto_total || 0);
        if (item.moneda === "USD") prestadoUSD += monto;
        if (item.moneda === "COP") prestadoCOP += monto;
      });

      const { data: pagos } = await supabase
        .from("pagos")
        .select("monto_pagado, moneda, fecha_pago")
        .eq("registrado_por_cedula", cedulaEmpleado)
        .gte("fecha_pago", `${hoy} 00:00:00`)
        .lt("fecha_pago", `${mañana} 00:00:00`);

      let recaudadoUSD = 0;
      let recaudadoCOP = 0;
      pagos?.forEach((item) => {
        const monto = Number(item.monto_pagado || 0);
        if (item.moneda === "USD") recaudadoUSD += monto;
        if (item.moneda === "COP") recaudadoCOP += monto;
      });

      const { data: gastos } = await supabase
        .from("gastos")
        .select("monto, moneda, fecha_gasto")
        .eq("registrado_por_cedula", cedulaEmpleado)
        .gte("fecha_gasto", `${hoy} 00:00:00`)
        .lt("fecha_gasto", `${mañana} 00:00:00`);

      let gastosUSD = 0;
      let gastosCOP = 0;
      gastos?.forEach((item) => {
        const monto = Number(item.monto || 0);
        if (item.moneda === "USD") gastosUSD += monto;
        if (item.moneda === "COP") gastosCOP += monto;
      });

      const netoUSD = recaudadoUSD - gastosUSD - prestadoUSD;
      const netoCOP = recaudadoCOP - gastosCOP - prestadoCOP;

      setResumen({
        prestadoHoy: { USD: prestadoUSD, COP: prestadoCOP },
        recaudadoHoy: { USD: recaudadoUSD, COP: recaudadoCOP },
        gastosHoy: { USD: gastosUSD, COP: gastosCOP },
        totalEntregar: {
          USD: Math.max(0, netoUSD),
          COP: Math.max(0, netoCOP),
        },
        excedenteCaja: {
          USD: netoUSD < 0 ? Math.abs(netoUSD) : 0,
          COP: netoCOP < 0 ? Math.abs(netoCOP) : 0,
        },
        activos: prestamos?.length || 0,
      });
    } catch (e) {
      console.log("Error en cargarResumenPersonal:", e);
    }
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

    setTotalCajasUSD(usd < 0 ? 0 : usd);
    setTotalCajasCOP(cop < 0 ? 0 : cop);
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
      if (item.moneda === "USD") usd += Number(item.monto || 0);
      if (item.moneda === "COP") cop += Number(item.monto || 0);
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
      if (p.moneda === "USD") cobrosUSD += Number(p.monto_pagado || 0);
      if (p.moneda === "COP") cobrosCOP += Number(p.monto_pagado || 0);
    });
    setTotalCobros({ USD: cobrosUSD, COP: cobrosCOP });

    const { data: cierres } = await supabase
      .from("cierres_caja")
      .select("ganancia_neta, moneda");
    let gananciaUSD = 0;
    let gananciaCOP = 0;
    cierres?.forEach((c) => {
      if (c.moneda === "USD") gananciaUSD += Number(c.ganancia_neta || 0);
      if (c.moneda === "COP") gananciaCOP += Number(c.ganancia_neta || 0);
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

  const totalGeneralCOP = resumen.prestadoHoy.COP + resumen.recaudadoHoy.COP;
  const totalGeneralUSD = resumen.prestadoHoy.USD + resumen.recaudadoHoy.USD;

  const porcentajePrestado =
    totalGeneralCOP > 0
      ? (resumen.prestadoHoy.COP / totalGeneralCOP) * 100
      : 50;
  const porcentajeRecaudado =
    totalGeneralCOP > 0
      ? (resumen.recaudadoHoy.COP / totalGeneralCOP) * 100
      : 50;

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
              ? "Resumen operativo general de caja, cobros y operaciones del día"
              : "Resumen financiero y accesos rápidos globales"}
        </Text>

        <View style={styles.cardGrid}>
          <View style={[styles.statCard]}>
            <Text style={styles.cardTitle}>
              {userRole === "empleado"
                ? "Tus Préstamos Hoy"
                : "Total Prestado Hoy"}
            </Text>
            <Text style={[styles.cardValue, { color: "#38bdf8" }]}>
              COP: ${resumen.prestadoHoy.COP.toLocaleString()}
            </Text>
            <Text style={[styles.cardSubValue, { color: "#38bdf8" }]}>
              USD: ${resumen.prestadoHoy.USD.toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statCard]}>
            <Text style={styles.cardTitle}>
              {userRole === "empleado"
                ? "Tus Cobros Hoy"
                : "Total Recaudado Hoy"}
            </Text>
            <Text style={[styles.cardValue, { color: "#4ade80" }]}>
              COP: ${resumen.recaudadoHoy.COP.toLocaleString()}
            </Text>
            <Text style={[styles.cardSubValue, { color: "#4ade80" }]}>
              USD: ${resumen.recaudadoHoy.USD.toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.cardGrid}>
          <View style={[styles.statCard]}>
            <Text style={styles.cardTitle}>
              {userRole === "empleado"
                ? "Tus Gastos Hoy"
                : "Gastos de Empleados Hoy"}
            </Text>
            <Text style={[styles.cardValue, { color: "#fbbf24" }]}>
              COP: ${resumen.gastosHoy.COP.toLocaleString()}
            </Text>
            <Text style={[styles.cardSubValue, { color: "#fbbf24" }]}>
              USD: ${resumen.gastosHoy.USD.toLocaleString()}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              {
                borderColor:
                  resumen.totalEntregar.COP > 0 ? "#10b981" : "#334155",
              },
            ]}
          >
            <Text style={styles.cardTitle}>Total a Entregar</Text>
            <Text style={[styles.cardValue, { color: "#10b981" }]}>
              COP: ${resumen.totalEntregar.COP.toLocaleString()}
            </Text>
            <Text style={[styles.cardSubValue, { color: "#10b981" }]}>
              USD: ${resumen.totalEntregar.USD.toLocaleString()}
            </Text>
          </View>
        </View>

        {(resumen.excedenteCaja.COP > 0 || resumen.excedenteCaja.USD > 0) && (
          <View style={[styles.cardGrid, { marginTop: -10 }]}>
            <View
              style={[
                styles.statCard,
                { borderColor: "#f43f5e", backgroundColor: "#4c0519" },
              ]}
            >
              <Text style={[styles.cardTitle, { color: "#fda4af" }]}>
                ⚠️ Excedente de Caja
              </Text>
              <Text style={[styles.cardValue, { color: "#fb7185" }]}>
                COP: ${resumen.excedenteCaja.COP.toLocaleString()}
              </Text>
              <Text style={[styles.cardSubValue, { color: "#fb7185" }]}>
                USD: ${resumen.excedenteCaja.USD.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

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
                COP: ${totalGeneralCOP.toLocaleString()}
              </Text>
              <Text style={styles.donutCenterSubValue}>
                USD: ${totalGeneralUSD.toLocaleString()}
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

        {/* MÓDULOS RESTRINGIDOS: Únicamente visibles para el Administrador */}
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
    marginBottom: 16,
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
  cardTitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
    fontWeight: "600",
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 2,
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
    width: 150,
    height: 150,
    borderRadius: 75,
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
    paddingHorizontal: 4,
  },
  donutCenterText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
  },
  donutCenterValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f8fafc",
    marginTop: 2,
  },
  donutCenterSubValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#38bdf8",
    marginTop: 2,
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
