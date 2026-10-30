import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../supabase";
import { obtenerFechaHoraExactaVenezuela } from "../../utils/fechas";

interface CajaOption {
  id: string;
  nombre: string;
  moneda: string;
}

interface Cliente {
  cedula: string;
  nombres: string;
  apellidos: string;
  registrado_por_cedula?: string;
  ruta_id?: string;
}

interface Prestamo {
  id: string;
  cedula: string;
  moneda: "USD" | "COP";
  monto_total: number;
  saldo_pendiente: number;
  valor_cuota: number;
  frecuencia: string;
  cuotas: number;
  estado: string;
  fecha_inicio: string;
  monto_prestado?: number;
  fecha_prestamo?: string;
}

export default function CrearPagoScreen({ route }: any) {
  const clienteCedulaParam = route?.params?.clienteCedula || null;
  const { width } = useWindowDimensions();
  const isWebOrTablet = width >= 768;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prestamosCliente, setPrestamosCliente] = useState<Prestamo[]>([]);
  const [cajas, setCajas] = useState<CajaOption[]>([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(
    clienteCedulaParam,
  );
  const [prestamoSeleccionado, setPrestamoSeleccionado] =
    useState<Prestamo | null>(null);

  const [modalClienteVisible, setModalClienteVisible] = useState(false);
  const [modalPrestamoVisible, setModalPrestamoVisible] = useState(false);
  const [modalTasaVisible, setModalTasaVisible] = useState(false);
  const [nombreBusqueda, setNombreBusqueda] = useState("");

  const [modalResultadoVisible, setModalResultadoVisible] = useState(false);
  const [tipoResultado, setTipoResultado] = useState<"exito" | "error">(
    "exito",
  );
  const [mensajeResultado, setMensajeResultado] = useState("");

  const [montoFisico, setMontoFisico] = useState("");
  const [monedaPrestamo, setMonedaPrestamo] = useState<"USD" | "COP">("COP");
  const [monedaPago, setMonedaPago] = useState<"USD" | "COP">("COP");
  const [tasaCambioCopPorUsd, setTasaCambioCopPorUsd] = useState("4100");
  const [tasaInputTemp, setTasaInputTemp] = useState("");

  // ESTADOS PARA FECHA MANUAL (Solo Administrador)
  const [usarFechaManual, setUsarFechaManual] = useState(false);
  const [fechaManual, setFechaManual] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Tipo de pago fijo en efectivo
  const tipoPago = "efectivo";

  const [loading, setLoading] = useState(false);
  const guardandoRef = useRef(false);

  const [usuarioActual, setUsuarioActual] = useState<{
    id: string;
    cedula: string;
    nombreCompleto: string;
    tipo: string;
  } | null>(null);

  useEffect(() => {
    obtenerUsuarioLogueadoYCargarDatos();
  }, []);

  // Recuperar el último cliente guardado de forma persistente (independiente de la sesión)
  useEffect(() => {
    const recuperarClienteSupabase = async () => {
      if (clientes.length > 0 && usuarioActual?.id) {
        if (clienteCedulaParam) {
          cargarPrestamosCliente(clienteCedulaParam);
        } else {
          try {
            const { data: cedulaGuardada, error } = await supabase.rpc(
              "obtener_ultima_preferencia_cliente",
              { p_usuario_id: usuarioActual.id },
            );

            if (!error && cedulaGuardada && !clienteSeleccionado) {
              const existe = clientes.some((c) => c.cedula === cedulaGuardada);
              if (existe) {
                setClienteSeleccionado(cedulaGuardada);
                cargarPrestamosCliente(cedulaGuardada);
              }
            }
          } catch (e) {
            console.log("Error al recuperar preferencia de Supabase:", e);
          }
        }
      }
    };
    recuperarClienteSupabase();
  }, [clientes, usuarioActual]);

  const obtenerUsuarioLogueadoYCargarDatos = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const emailLogueado = authData.user?.email?.trim().toLowerCase();

      if (!userId && !emailLogueado) {
        mostrarMensaje("error", "No hay una sesión activa en el sistema.");
        return;
      }

      let usuarioInfo: any = null;

      let queryAdmin = supabase
        .from("administradores")
        .select("id, cedula, nombres, apellidos");
      if (userId) queryAdmin = queryAdmin.eq("id", userId);
      else if (emailLogueado)
        queryAdmin = queryAdmin.eq("correo", emailLogueado);
      const { data: adminData } = await queryAdmin.maybeSingle();

      if (adminData) {
        usuarioInfo = {
          id: adminData.id,
          cedula: adminData.cedula,
          nombreCompleto: `${adminData.nombres} ${adminData.apellidos}`,
          tipo: "Administrador",
        };
      }

      if (!usuarioInfo) {
        let querySec = supabase
          .from("secretaria")
          .select("id, cedula, nombres, apellidos");
        if (userId) querySec = querySec.eq("id", userId);
        else if (emailLogueado) querySec = querySec.eq("correo", emailLogueado);
        const { data: secData } = await querySec.maybeSingle();
        if (secData) {
          usuarioInfo = {
            id: secData.id,
            cedula: secData.cedula,
            nombreCompleto: `${secData.nombres} ${secData.apellidos}`,
            tipo: "Secretaria",
          };
        }
      }

      if (!usuarioInfo) {
        let queryEmp = supabase
          .from("empleados")
          .select("id, cedula, nombres, apellidos");
        if (userId) queryEmp = queryEmp.eq("id", userId);
        else if (emailLogueado) queryEmp = queryEmp.eq("correo", emailLogueado);
        const { data: empData } = await queryEmp.maybeSingle();
        if (empData) {
          usuarioInfo = {
            id: empData.id,
            cedula: empData.cedula,
            nombreCompleto: `${empData.nombres} ${empData.apellidos}`,
            tipo: "Empleado",
          };
        }
      }

      if (!usuarioInfo || !usuarioInfo.cedula) {
        mostrarMensaje(
          "error",
          "No se pudo identificar qué usuario está realizando el registro.",
        );
        return;
      }

      setUsuarioActual(usuarioInfo);
      await cargarCajas();
      await cargarClientes(usuarioInfo);
    } catch (err) {
      console.log("Error obteniendo usuario actual:", err);
      mostrarMensaje(
        "error",
        "Error de conexión al verificar los datos del usuario.",
      );
      await cargarCajas();
    }
  };

  const cargarCajas = async () => {
    const { data } = await supabase
      .from("cajas_bancos")
      .select("id, nombre, moneda");
    if (data) setCajas(data);
  };

  const cargarClientes = async (infoUsuario: {
    id: string;
    cedula: string;
    tipo: string;
  }) => {
    let query = supabase
      .from("clientes")
      .select("cedula, nombres, apellidos, registrado_por_cedula, ruta_id")
      .order("nombres");

    if (infoUsuario.tipo === "Empleado") {
      const { data: rutasAsignadas, error: errorRutas } = await supabase
        .from("empleado_rutas")
        .select("ruta_id")
        .eq("empleado_id", infoUsuario.id);

      if (errorRutas || !rutasAsignadas || rutasAsignadas.length === 0) {
        setClientes([]);
        return;
      }

      const idsRutas = rutasAsignadas.map((r) => r.ruta_id);
      query = query.in("ruta_id", idsRutas);
    }

    const { data, error } = await query;
    if (!error && data) {
      setClientes(data);
    } else {
      setClientes([]);
    }
  };

  const cargarPrestamosCliente = async (cedulaCliente: string) => {
    const { data, error } = await supabase
      .from("prestamos")
      .select("*")
      .eq("cedula", cedulaCliente)
      .eq("estado", "activo");

    if (error) {
      setPrestamosCliente([]);
    } else if (data) {
      setPrestamosCliente(data);
      if (data.length > 0) {
        seleccionarPrestamo(data[0]);
      } else {
        setPrestamoSeleccionado(null);
      }
    }
  };

  const seleccionarPrestamo = (prestamo: Prestamo) => {
    setPrestamoSeleccionado(prestamo);
    setMonedaPrestamo(prestamo.moneda);
    setMonedaPago(prestamo.moneda);
    setMontoFisico("");
  };

  const handleSeleccionarCliente = async (cedula: string) => {
    setClienteSeleccionado(cedula);
    setPrestamoSeleccionado(null);
    setModalClienteVisible(false);

    if (usuarioActual?.id) {
      try {
        await supabase.rpc("guardar_ultima_preferencia_cliente", {
          p_usuario_id: usuarioActual.id,
          p_cedula: cedula,
        });
      } catch (e) {
        console.log("Error al guardar preferencia en Supabase:", e);
      }
    }

    cargarPrestamosCliente(cedula);
  };

  const cambiarMonedaPago = (nuevaMoneda: "USD" | "COP") => {
    setMonedaPago(nuevaMoneda);
    if (nuevaMoneda !== monedaPrestamo) {
      setTasaInputTemp(tasaCambioCopPorUsd);
      setModalTasaVisible(true);
    }
  };

  const formatearSinDecimales = (valor: string | number) => {
    if (valor === "" || valor === null || valor === undefined) return "";
    const numeroStr =
      typeof valor === "number"
        ? Math.round(valor).toString()
        : valor.toString();
    const limpio = numeroStr.replace(/[^\d]/g, "");
    return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleMontoChange = (text: string) => {
    const soloDigitos = text.replace(/\D/g, "").slice(0, 9);
    setMontoFisico(
      soloDigitos === ""
        ? ""
        : soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    );
  };

  const limpiarMontoParaCalculo = (val: string) => {
    if (!val) return 0;
    return parseInt(val.replace(/\./g, ""), 10) || 0;
  };

  const montoFisicoNum = limpiarMontoParaCalculo(montoFisico);
  const tasaNum = parseFloat(tasaCambioCopPorUsd) || 1;

  let montoAplicadoPrestamo = 0;
  if (monedaPrestamo === monedaPago) {
    montoAplicadoPrestamo = montoFisicoNum;
  } else if (monedaPrestamo === "USD" && monedaPago === "COP") {
    montoAplicadoPrestamo =
      tasaNum > 0 ? Math.round(montoFisicoNum / tasaNum) : 0;
  } else if (monedaPrestamo === "COP" && monedaPago === "USD") {
    montoAplicadoPrestamo = Math.round(montoFisicoNum * tasaNum);
  }

  const mostrarMensaje = (tipo: "exito" | "error", mensaje: string) => {
    setTipoResultado(tipo);
    setMensajeResultado(mensaje);
    setModalResultadoVisible(true);
  };

  const guardarPago = async () => {
    if (guardandoRef.current || loading) return;
    guardandoRef.current = true;

    if (!clienteSeleccionado) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Por favor seleccione un cliente.");
      return;
    }
    if (!prestamoSeleccionado) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Por favor seleccione el préstamo a abonar.");
      return;
    }
    if (montoFisicoNum <= 0) {
      guardandoRef.current = false;
      mostrarMensaje("error", "Ingrese un monto de pago válido mayor a 0.");
      return;
    }
    if (montoAplicadoPrestamo > prestamoSeleccionado.saldo_pendiente) {
      guardandoRef.current = false;
      mostrarMensaje(
        "error",
        `El monto convertido ($ ${formatearSinDecimales(montoAplicadoPrestamo)} ${monedaPrestamo}) supera el saldo pendiente del préstamo.`,
      );
      return;
    }
    if (!usuarioActual) {
      guardandoRef.current = false;
      mostrarMensaje("error", "No se pudo identificar el usuario logueado.");
      return;
    }

    if (usarFechaManual && usuarioActual.tipo === "Administrador") {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
      if (!regexFecha.test(fechaManual)) {
        guardandoRef.current = false;
        mostrarMensaje(
          "error",
          "El formato de la fecha manual debe ser AAAA-MM-DD.",
        );
        return;
      }
    }

    setLoading(true);

    const prestamoIdActual = prestamoSeleccionado.id;
    const monedaPActual = monedaPrestamo;
    const montoPActual = montoAplicadoPrestamo;
    const monedaPagoActual = monedaPago;
    const tasaActual = tasaNum;
    const cedulaUsuarioActual = usuarioActual.cedula;

    const datosPago: any = {
      prestamo_id: prestamoIdActual,
      moneda: monedaPActual,
      monto_pagado: montoPActual,
      moneda_pago: monedaPagoActual,
      tasa_cambio: tasaActual,
      registrado_por_cedula: cedulaUsuarioActual,
      fecha_pago:
        usarFechaManual && usuarioActual.tipo === "Administrador"
          ? `${fechaManual}T00:00:00`
          : obtenerFechaHoraExactaVenezuela(),
    };

    setMontoFisico("");
    setPrestamoSeleccionado(null);
    setPrestamosCliente([]);

    try {
      const { error: errorPago } = await supabase
        .from("pagos")
        .insert([datosPago]);

      if (errorPago) throw errorPago;

      mostrarMensaje(
        "exito",
        "El pago con cambio de divisa se ha registrado satisfactoriamente.",
      );
    } catch (err: any) {
      mostrarMensaje(
        "error",
        err.message ||
          "Ocurrió un error inesperado al intentar registrar el pago.",
      );
    } finally {
      setLoading(false);
      guardandoRef.current = false;
    }
  };

  const clientesFiltradosOriginal = clientes.filter((c) =>
    `${c.nombres} ${c.apellidos} ${c.cedula}`
      .toLowerCase()
      .includes(nombreBusqueda.toLowerCase()),
  );

  const clientesFiltrados = [...clientesFiltradosOriginal].sort((a, b) => {
    if (a.cedula === clienteSeleccionado) return -1; // Pone al seleccionado de primero
    if (b.cedula === clienteSeleccionado) return 1; // Pone al seleccionado de primero
    return 0; // Mantiene el orden original para el resto
  });

  const clienteObjetoSeleccionado = clientes.find(
    (c) => c.cedula === clienteSeleccionado,
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          isWebOrTablet && styles.contentContainerWeb,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mainCard, isWebOrTablet && styles.mainCardWeb]}>
          <Text style={styles.title}>Registrar Cobro / Pago</Text>

          {usuarioActual && (
            <View style={styles.userCard}>
              <Text style={styles.userCardTitle}>
                Registrado por ({usuarioActual.tipo}):
              </Text>
              <Text style={styles.userCardText}>
                {usuarioActual.nombreCompleto}
              </Text>
            </View>
          )}

          <Text style={styles.label}>1. Cliente</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            activeOpacity={0.7}
            onPress={() => setModalClienteVisible(true)}
          >
            {clienteObjetoSeleccionado ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownTriggerTitle}>
                  {clienteObjetoSeleccionado.nombres}{" "}
                  {clienteObjetoSeleccionado.apellidos}
                </Text>
              </View>
            ) : (
              <Text style={styles.dropdownTriggerPlaceholder}>
                Seleccionar cliente...
              </Text>
            )}
            <Text style={styles.dropdownTriggerIcon}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>2. Préstamo Activo</Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              !clienteSeleccionado && { opacity: 0.6 },
            ]}
            activeOpacity={0.7}
            disabled={!clienteSeleccionado}
            onPress={() => setModalPrestamoVisible(true)}
          >
            {prestamoSeleccionado ? (
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownTriggerTitle}>
                  Préstamo en {prestamoSeleccionado.moneda} | Saldo: ${" "}
                  {formatearSinDecimales(
                    prestamoSeleccionado.saldo_pendiente || 0,
                  )}
                </Text>
                <Text style={styles.dropdownTriggerSubtitle}>
                  Cuota: ${" "}
                  {formatearSinDecimales(prestamoSeleccionado.valor_cuota || 0)}{" "}
                  ({prestamoSeleccionado.frecuencia})
                </Text>
              </View>
            ) : (
              <Text style={styles.dropdownTriggerPlaceholder}>
                {clienteSeleccionado
                  ? "Seleccionar préstamo activo..."
                  : "Primero seleccione un cliente"}
              </Text>
            )}
            <Text style={styles.dropdownTriggerIcon}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.label}>
            3. ¿En qué moneda realiza el pago el cliente?
          </Text>
          <View style={styles.rowSelector}>
            {(["COP", "USD"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.selectChip,
                  monedaPago === m && styles.selectChipActive,
                ]}
                onPress={() => cambiarMonedaPago(m)}
              >
                <Text
                  style={[
                    styles.selectChipTxt,
                    monedaPago === m && styles.selectChipTxtActive,
                  ]}
                >
                  {m === "COP" ? "🇨🇴 Pesos (COP)" : "💵 Dólares (USD)"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {monedaPago !== monedaPrestamo && (
            <TouchableOpacity
              style={styles.tasaBanner}
              onPress={() => setModalTasaVisible(true)}
            >
              <Text style={styles.tasaBannerText}>
                💱 Tasa aplicada:{" "}
                <Text style={styles.bold}>
                  1 USD = $ {tasaCambioCopPorUsd} COP
                </Text>{" "}
                (Click para editar)
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>
            4. Monto Entregado Físicamente ({monedaPago})
          </Text>
          <TextInput
            style={styles.input}
            placeholder={`Monto en ${monedaPago}`}
            value={montoFisico}
            onChangeText={handleMontoChange}
            keyboardType="numeric"
            maxLength={15}
            placeholderTextColor="#a4b0be"
          />
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={guardarPago}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Registrar Pago</Text>
            )}
          </TouchableOpacity>

          {usuarioActual?.tipo === "Administrador" && (
            <View style={styles.manualDateBox}>
              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setUsarFechaManual(!usarFechaManual)}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    usarFechaManual && styles.checkboxBoxChecked,
                  ]}
                >
                  {usarFechaManual && (
                    <Text style={styles.checkboxTick}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  📅 Registrar fecha de pago (Manual)
                </Text>
              </TouchableOpacity>

              {usarFechaManual && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.subLabel}>
                    Seleccione la fecha del pago:
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026-09-01"
                    value={fechaManual}
                    onChangeText={setFechaManual}
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.helperText}>
                    Formato requerido: AAAA-MM-DD (Ej: 2026-05-15)
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.calcBox}>
            <Text style={styles.calcTitle}>Resumen de Conversión y Cobro</Text>
            <View style={styles.calcRow}>
              <Text style={styles.calcText}>Saldo Actual del Préstamo:</Text>
              <Text style={styles.bold}>
                ${" "}
                {prestamoSeleccionado
                  ? formatearSinDecimales(prestamoSeleccionado.saldo_pendiente)
                  : "0"}{" "}
                {monedaPrestamo}
              </Text>
            </View>

            <View style={styles.calcRow}>
              <Text style={styles.calcText}>
                Monto Recibido ({monedaPago}):
              </Text>
              <Text style={styles.bold}>
                $ {formatearSinDecimales(montoFisicoNum)} {monedaPago}
              </Text>
            </View>
            {monedaPago !== monedaPrestamo && (
              <View style={styles.calcRow}>
                <Text style={styles.calcText}>
                  Equivalente Abonado al Préstamo:
                </Text>
                <Text style={styles.boldPrimary}>
                  $ {formatearSinDecimales(montoAplicadoPrestamo)}{" "}
                  {monedaPrestamo}
                </Text>
              </View>
            )}
            <View style={styles.calcRow}>
              <Text style={styles.calcText}>Nuevo Saldo Resultante:</Text>
              <Text style={styles.bold}>
                ${" "}
                {prestamoSeleccionado
                  ? formatearSinDecimales(
                      Math.max(
                        0,
                        prestamoSeleccionado.saldo_pendiente -
                          montoAplicadoPrestamo,
                      ),
                    )
                  : "0"}{" "}
                {monedaPrestamo}
              </Text>
            </View>
          </View>
        </View>

        {/* MODAL TASA DE CAMBIO */}
        <Modal
          visible={modalTasaVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setModalTasaVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalExitoContainer, { maxWidth: 380 }]}>
              <Text style={styles.modalExitoTitle}>Tasa de Cambio</Text>
              <Text style={styles.modalExitoMessage}>
                Ingrese la tasa de cambio actual (COP por 1 USD):
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    width: "100%",
                    textAlign: "center",
                    fontSize: 18,
                    fontWeight: "bold",
                  },
                ]}
                placeholder="Ej: 4100"
                keyboardType="numeric"
                value={tasaInputTemp}
                onChangeText={setTasaInputTemp}
                autoFocus={true}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  if (tasaInputTemp && parseFloat(tasaInputTemp) > 0) {
                    setTasaCambioCopPorUsd(tasaInputTemp);
                    setModalTasaVisible(false);
                  } else {
                    mostrarMensaje("error", "Ingrese una tasa válida.");
                  }
                }}
              >
                <Text style={styles.successButtonText}>Guardar Tasa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL DE SELECCIÓN DE CLIENTE */}
        <Modal
          visible={modalClienteVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setModalClienteVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Buscar y Seleccionar Cliente
                </Text>
                <TouchableOpacity
                  onPress={() => setModalClienteVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.searchBoxContainer}>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="🔍 Escribe nombre o cédula..."
                  value={nombreBusqueda}
                  onChangeText={setNombreBusqueda}
                  placeholderTextColor="#94a3b8"
                  autoFocus={true}
                />
              </View>
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
              >
                {clientesFiltrados.map((item) => {
                  const isSelected = clienteSeleccionado === item.cedula;
                  return (
                    <TouchableOpacity
                      key={item.cedula}
                      style={[
                        styles.modalClientCard,
                        isSelected && styles.modalClientCardSelected,
                      ]}
                      onPress={() => handleSeleccionarCliente(item.cedula)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalClientName,
                            isSelected && styles.textWhite,
                          ]}
                        >
                          {item.nombres} {item.apellidos}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE SELECCIÓN DE PRÉSTAMO */}
        <Modal
          visible={modalPrestamoVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setModalPrestamoVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Seleccionar Préstamo Activo
                </Text>
                <TouchableOpacity
                  onPress={() => setModalPrestamoVisible(false)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
              >
                {prestamosCliente.map((item) => {
                  const isSelected = prestamoSeleccionado?.id === item.id;

                  const formatearFecha = (fechaStr: string) => {
                    if (!fechaStr) return "";
                    const [anio, mes, dia] = fechaStr.split("T")[0].split("-");
                    return `${dia}/${mes}/${anio}`;
                  };

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.modalClientCard,
                        isSelected && styles.modalClientCardSelected,
                      ]}
                      onPress={() => {
                        seleccionarPrestamo(item);
                        setModalPrestamoVisible(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.modalClientName,
                            isSelected && styles.textWhite,
                          ]}
                        >
                          Prestado: ${" "}
                          {formatearSinDecimales(item.monto_prestado || 0)}{" "}
                          {item.moneda}
                        </Text>
                        <Text
                          style={[
                            styles.modalClientCedula,
                            isSelected && styles.textWhiteSub,
                          ]}
                        >
                          Total: $ {formatearSinDecimales(item.monto_total)} |
                          Pendiente: ${" "}
                          {formatearSinDecimales(item.saldo_pendiente)}
                        </Text>
                        <Text
                          style={[
                            styles.modalClientCedula,
                            isSelected && styles.textWhiteSub,
                          ]}
                        >
                          Cuota: ${" "}
                          {formatearSinDecimales(item.valor_cuota || 0)} (
                          {item.frecuencia}) | Fecha:{" "}
                          {formatearFecha(item.fecha_prestamo || "")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL DE RESULTADO */}
        <Modal
          visible={modalResultadoVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setModalResultadoVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalExitoContainer}>
              <View
                style={[
                  styles.successIconContainer,
                  tipoResultado === "error" && styles.errorIconContainer,
                ]}
              >
                <Text style={styles.successIconText}>
                  {tipoResultado === "exito" ? "✓" : "✕"}
                </Text>
              </View>
              <Text style={styles.modalExitoTitle}>
                {tipoResultado === "exito" ? "¡Pago Registrado!" : "Atención"}
              </Text>
              <Text style={styles.modalExitoMessage}>{mensajeResultado}</Text>
              <TouchableOpacity
                style={[
                  styles.successButton,
                  tipoResultado === "error" && styles.errorButton,
                ]}
                onPress={() => setModalResultadoVisible(false)}
              >
                <Text style={styles.successButtonText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  contentContainer: { padding: 12, paddingBottom: 60 },
  contentContainerWeb: { alignItems: "center", padding: 24 },
  mainCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  mainCardWeb: {
    maxWidth: 750,
    padding: 32,
    borderWidth: 1,
    borderColor: "#e4e7eb",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1e293b",
  },
  userCard: {
    backgroundColor: "#e0f2fe",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  userCardTitle: { fontSize: 12, color: "#0369a1", fontWeight: "600" },
  userCardText: { fontSize: 14, color: "#0c4a6e", fontWeight: "bold" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    marginTop: 12,
  },
  subLabel: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  bold: { fontWeight: "bold", color: "#1e293b" },
  boldPrimary: { fontWeight: "bold", color: "#0284c7" },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownTriggerTitle: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  dropdownTriggerSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  dropdownTriggerPlaceholder: { fontSize: 15, color: "#94a3b8" },
  dropdownTriggerIcon: { fontSize: 12, color: "#64748b", marginLeft: 8 },
  rowSelector: { flexDirection: "row", gap: 8 },
  selectChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  selectChipActive: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  selectChipTxt: { fontSize: 14, fontWeight: "600", color: "#475569" },
  selectChipTxtActive: { color: "#ffffff" },
  tasaBanner: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  tasaBannerText: { fontSize: 13, color: "#92400e", textAlign: "center" },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
  },
  calcBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calcTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  calcText: { fontSize: 13, color: "#64748b" },
  manualDateBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxBoxChecked: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  checkboxTick: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  checkboxLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  helperText: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  button: {
    backgroundColor: "#0284c7",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1e293b" },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: "#64748b", fontWeight: "bold" },
  searchBoxContainer: { padding: 12, backgroundColor: "#f8fafc" },
  modalSearchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalList: { paddingHorizontal: 12 },
  modalListContent: { paddingVertical: 8 },
  modalClientCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalClientCardSelected: {
    backgroundColor: "#0284c7",
    borderColor: "#0284c7",
  },
  modalClientName: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  modalClientCedula: { fontSize: 13, color: "#64748b", marginTop: 2 },
  textWhite: { color: "#ffffff" },
  textWhiteSub: { color: "#e0f2fe" },
  modalExitoContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  successIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIconContainer: { backgroundColor: "#fee2e2" },
  successIconText: { fontSize: 28, color: "#16a34a", fontWeight: "bold" },
  modalExitoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  modalExitoMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  successButton: {
    width: "100%",
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  errorButton: { backgroundColor: "#dc2626" },
  successButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "bold" },
});
