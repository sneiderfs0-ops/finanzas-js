import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../supabase";
import { useFocusEffect } from "expo-router/react-navigation";

export default function IndexScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const [totalGananciaUSD, setTotalGananciaUSD] = useState(0);
  const [totalGananciaCOP, setTotalGananciaCOP] = useState(0);

  const verificarSesionYDatos = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session || !session.user?.email) {
        router.replace("/(auth)/sign-in" as any);
        return;
      }

      const emailUser = session.user.email.trim().toLowerCase();

      // 1. Verificar en ADMINISTRADORES
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

        const channelName = `rt-admin-global-${session.user.id}-${Date.now()}`;
        const channelAdmin = supabase
          .channel(channelName)
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
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "clientes" },
            () => {
              cargarClientesYEmpleados();
            },
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "cajas_bancos" },
            () => {
              cargarCajasYBancos();
            },
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "cierres_caja" },
            () => {
              cargarCobrosYGanancias();
            },
          )
          .subscribe();

        setLoading(false);
        setRefreshing(false);
        return () => {
          supabase.removeChannel(channelAdmin);
        };
      }

      // 2. Verificar en SECRETARIA
      const { data: secretariaData } = await supabase
        .from("secretaria")
        .select("*")
        .eq("correo", emailUser)
        .maybeSingle();

      if (secretariaData) {
        setUserRole("secretaria");
        setUserData(secretariaData);
        await Promise.all([
          cargarResumenGeneral(),
          cargarCajasYBancos(),
          cargarClientesYEmpleados(),
          cargarGastosYNomina(),
          cargarCobrosYGanancias(),
        ]);

        const channelName = `rt-secretaria-global-${session.user.id}-${Date.now()}`;
        const channelSecretaria = supabase
          .channel(channelName)
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
              cargarCobrosYGanancias();
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
          .subscribe();

        setLoading(false);
        setRefreshing(false);
        return () => {
          supabase.removeChannel(channelSecretaria);
        };
      }

      // 3. Verificar en EMPLEADOS
      const { data: empleadoData } = await supabase
        .from("empleados")
        .select("*")
        .eq("correo", emailUser)
        .maybeSingle();

      if (empleadoData) {
        setUserRole("empleado");
        setUserData(empleadoData);
        await cargarResumenPersonal(empleadoData.cedula);

        const channelName = `rt-empleado-${empleadoData.cedula}-${Date.now()}`;
        const channelEmpleado = supabase
          .channel(channelName)
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
            (payload: any) => {
              if (payload.new.cedula === empleadoData.cedula) {
                setUserData(payload.new);
              }
            },
          )
          .subscribe();

        setLoading(false);
        setRefreshing(false);
        return () => {
          supabase.removeChannel(channelEmpleado);
        };
      }

      setLoading(false);
      setRefreshing(false);
    } catch (e) {
      console.log("Error en verificarSesionYDatos:", e);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const cargarResumenGeneral = async () => {
    try {
      const { data, error } = await supabase.rpc("obtener_resumen_diario");

      if (error) {
        console.log("Error en RPC obtener_resumen_diario:", error);
        return;
      }

      let prestadoUSD = 0;
      let prestadoCOP = 0;
      let recaudadoUSD = 0;
      let recaudadoCOP = 0;
      let gastosUSD = 0;
      let gastosCOP = 0;

      data?.forEach((item: any) => {
        const moneda = (item.moneda || "").toUpperCase();

        if (moneda === "USD") {
          prestadoUSD = Number(item.total_prestado || 0);
          recaudadoUSD = Number(item.total_recaudado || 0);
          gastosUSD = Number(item.total_gastos || 0);
        } else if (moneda === "COP") {
          prestadoCOP = Number(item.total_prestado || 0);
          recaudadoCOP = Number(item.total_recaudado || 0);
          gastosCOP = Number(item.total_gastos || 0);
        }
      });

      const netoUSD = recaudadoUSD - gastosUSD - prestadoUSD;
      const netoCOP = recaudadoCOP - gastosCOP - prestadoCOP;

      const { count: countActivos } = await supabase
        .from("prestamos")
        .select("*", { count: "exact", head: true })
        .eq("estado", "activo");

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
        activos: countActivos || 0,
      });
    } catch (e) {
      console.log("Error en cargarResumenGeneral:", e);
    }
  };

  const cargarResumenPersonal = async (cedulaEmpleado: string) => {
    try {
      const { data, error } = await supabase.rpc("obtener_resumen_personal", {
        p_cedula: cedulaEmpleado,
      });

      if (error) {
        console.log("Error en RPC obtener_resumen_personal:", error);
        return;
      }

      let prestadoUSD = 0;
      let prestadoCOP = 0;
      let recaudadoUSD = 0;
      let recaudadoCOP = 0;
      let gastosUSD = 0;
      let gastosCOP = 0;
      let cantidadActivos = 0;

      data?.forEach((item: any) => {
        const moneda = (item.moneda || "").toUpperCase();
        const prestado = Number(item.total_prestado || 0);
        const recaudado = Number(item.total_recaudado || 0);
        const gastos = Number(item.total_gastos || 0);

        if (moneda === "USD") {
          prestadoUSD = prestado;
          recaudadoUSD = recaudado;
          gastosUSD = gastos;
        } else if (moneda === "COP") {
          prestadoCOP = prestado;
          recaudadoCOP = recaudado;
          gastosCOP = gastos;
        }

        cantidadActivos += Number(item.cantidad_prestamos || 0);
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
        activos: cantidadActivos,
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
    data?.forEach((item: any) => {
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
    gastos?.forEach((item: any) => {
      if (item.moneda === "USD") usd += Number(item.monto || 0);
      if (item.moneda === "COP") cop += Number(item.monto || 0);
    });
    setTotalGastosNomina({ USD: usd, COP: cop });
  };

  const cargarCobrosYGanancias = async () => {
    try {
      const { data: pagosData, error: pagosError } = await supabase
        .from("pagos")
        .select("monto_pagado, moneda");

      let cobrosUSD = 0;
      let cobrosCOP = 0;

      if (!pagosError && pagosData) {
        pagosData.forEach((item: any) => {
          const moneda = (item.moneda || "").toUpperCase();
          const monto = Number(item.monto_pagado || 0);
          if (moneda === "USD") cobrosUSD += monto;
          else if (moneda === "COP") cobrosCOP += monto;
        });
      }

      setTotalCobros({ USD: cobrosUSD, COP: cobrosCOP });

      const { data: gananciaData, error: gananciaError } = await supabase.rpc(
        "obtener_ganancias_netas_generales",
      );

      let netaUSD = 0;
      let netaCOP = 0;

      if (!gananciaError && gananciaData) {
        gananciaData.forEach((item: any) => {
          const moneda = (item.moneda || "").toUpperCase();
          const montoNeta = Number(item.ganancia_neta_final || 0);

          if (moneda === "USD") {
            netaUSD = montoNeta;
          } else if (moneda === "COP") {
            netaCOP = montoNeta;
          }
        });
      }

      setTotalGananciaUSD(netaUSD);
      setTotalGananciaCOP(netaCOP);
      setGananciasNeta({ USD: netaUSD, COP: netaCOP });
    } catch (e) {
      console.log("Error en cargarCobrosYGanancias:", e);
    }
  };

  useEffect(() => {
    const intervalo = setInterval(() => {
      const ahora = new Date();
      const horaCaracas = ahora.toLocaleString("en-US", {
        timeZone: "America/Caracas",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });

      if (horaCaracas === "1:00" || horaCaracas === "01:00") {
        verificarSesionYDatos();
      }
    }, 60000);

    return () => clearInterval(intervalo);
  }, [verificarSesionYDatos]);

  useFocusEffect(
    useCallback(() => {
      verificarSesionYDatos();
    }, [verificarSesionYDatos]),
  );

  useEffect(() => {
    verificarSesionYDatos();
  }, [verificarSesionYDatos]);

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => verificarSesionYDatos(true)}
          colors={["#6366f1"]}
          tintColor="#6366f1"
        />
      }
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
            <Text style={styles.cardTitle}>
              {userRole === "empleado" ? "Total a Entregar" : "Total a Recibir"}
            </Text>
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

        {(userRole === "administrador" || userRole === "secretaria") && (
          <>
            <Text style={styles.sectionTitle}>Módulos y Saldos</Text>

            <View style={styles.menuGrid}>
              <TouchableOpacity
                style={[styles.menuCard, { borderLeftColor: "#a855f7" }]}
                onPress={() => router.push("/(tabs)/clientes" as any)}
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
                onPress={() => router.push("/(tabs)/lista-prestamos" as any)}
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
                onPress={() => router.push("/(tabs)/caja" as any)}
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
                onPress={() => router.push("/(tabs)/gastos" as any)}
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
                onPress={() => router.push("/(tabs)/empleados" as any)}
              >
                <Text style={styles.menuEmoji}>👥</Text>
                <Text style={styles.menuTitle}>Empleados</Text>
                <Text style={styles.saldoText}>
                  Activos:{" "}
                  <Text style={styles.boldSaldo}>{totalEmpleados}</Text>
                </Text>
                <Text style={styles.menuDesc}>Autorizaciones y personal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/caja" as any)}
                style={[styles.menuCard, { borderLeftColor: "#10b981" }]}
              >
                <Text style={styles.menuEmoji}>📈</Text>
                <Text style={styles.menuTitle}>Ganancias</Text>
                <Text style={styles.saldoText}>
                  USD:{" "}
                  <Text style={styles.boldGanancia}>
                    ${Number(gananciasNeta.USD.toFixed(0)).toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.saldoText}>
                  COP:{" "}
                  <Text style={styles.boldGanancia}>
                    ${Number(gananciasNeta.COP.toFixed(0)).toLocaleString()}
                  </Text>
                </Text>
                <Text style={styles.menuDesc}>
                  Utilidades netas registradas
                </Text>
              </TouchableOpacity>
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
