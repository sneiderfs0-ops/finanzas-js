import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { supabase } from "../../supabase";
import { colors } from "@/constants/globalStyles";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";

export default function InventarioScreen() {
  const router = useRouter();
  const [productos, setProductos] = useState<any[]>([]);
  const [cajas, setCajas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [cedulaAdminActual, setCedulaAdminActual] =
    useState<string>("00000000");

  const [modalClienteVisible, setModalClienteVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalVentaVisible, setModalVentaVisible] = useState(false);

  // Estados para Detalles y Abonos
  const [modalDetallesVisible, setModalDetallesVisible] = useState(false);
  const [detallesPrestamo, setDetallesPrestamo] = useState<any>(null);

  // Estados para el Modal de Pago / Abono
  const [modalPagoVisible, setModalPagoVisible] = useState(false);
  const [productoPagoSeleccionado, setProductoPagoSeleccionado] =
    useState<any>(null);
  const [prestamoAsociado, setPrestamoAsociado] = useState<any>(null);
  const [montoAbono, setMontoAbono] = useState("");
  const [cajaPagoId, setCajaPagoId] = useState("");

  const [clientesList, setClientesList] = useState<any[]>([]);
  const [tipoOperacion, setTipoOperacion] = useState("contado");
  const [monedaSeleccionada, setMonedaSeleccionada] = useState("USD");
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [cajaSeleccionadaId, setCajaSeleccionadaId] = useState<string | null>(
    null,
  );

  // Producto y datos de la venta
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [cajaIdSeleccionada, setCajaIdSeleccionada] = useState("");
  const [montoVenta, setMontoVenta] = useState("");
  const [monedaVenta, setMonedaVenta] = useState("USD");

  // Estados para venta a crédito / cuotas
  const [tipoTransaccion, setTipoTransaccion] = useState<"contado" | "credito">(
    "contado",
  );
  const [abonoInicial, setAbonoInicial] = useState("");
  const [numeroCuotas, setNumeroCuotas] = useState("1");
  const [frecuenciaCuota, setFrecuenciaCuota] = useState("Mensual");

  // Campos para nuevo producto (Compra)
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [monedaProducto, setMonedaProducto] = useState("USD");
  const [cajaCompraId, setCajaCompraId] = useState("");

  useEffect(() => {
    cargarProductos();
    cargarCajas();
    cargarClientes();
    obtenerUsuarioLogueado();
  }, []);

  useEffect(() => {
    if (modalVentaVisible && !cajaIdSeleccionada) {
      const cajasCompatibles = cajas.filter(
        (c) => c.moneda === monedaSeleccionada,
      );
      if (cajasCompatibles.length > 0) {
        setCajaIdSeleccionada(cajasCompatibles[0].id);
      }
    }
  }, [modalVentaVisible, monedaSeleccionada]);

  const obtenerUsuarioLogueado = async () => {
    try {
      const cedula = await AsyncStorage.getItem("cedulaAdminActual");
      if (cedula) setCedulaAdminActual(cedula);
    } catch (error) {
      console.error("Error al obtener usuario logueado:", error);
    }
  };

  const cargarProductos = async () => {
    const { data, error } = await supabase.from("productos").select("*");
    if (error)
      console.error("Error al cargar productos:", JSON.stringify(error));
    else setProductos(data || []);
  };

  const cargarCajas = async () => {
    const { data, error } = await supabase.from("cajas_bancos").select("*");
    if (error) console.error("Error al cargar cajas:", JSON.stringify(error));
    else setCajas(data || []);
  };

  const cargarClientes = async () => {
    const { data, error } = await supabase.from("clientes").select("*");
    if (data) {
      setClientesList(data);
    } else if (error) {
      console.error("Error al cargar clientes:", error);
    }
  };

  const abrirModalCrear = () => {
    setNombre("");
    setCategoria("");
    setPrecioCompra("");
    setPrecioVenta("");
    setMonedaProducto("USD");
    setCajaCompraId("");
    cargarCajas();
    setModalVisible(true);
  };

  const registrarProducto = async () => {
    if (!nombre || !precioCompra || !precioVenta) {
      Alert.alert("Error", "Por favor completa los campos obligatorios.");
      return;
    }
    if (!cajaCompraId) {
      Alert.alert(
        "Atención",
        "Por favor selecciona una caja o banco para debitar el costo de compra.",
      );
      return;
    }

    try {
      const costoCompraNum = parseFloat(precioCompra);
      const cajaSeleccionada = cajas.find((c) => c.id === cajaCompraId);

      if (!cajaSeleccionada) {
        Alert.alert("Error", "La caja seleccionada no es válida.");
        return;
      }

      const { data: productoInsertado, error: errorProd } = await supabase
        .from("productos")
        .insert([
          {
            nombre,
            categoria: categoria || "general",
            precio_compra: costoCompraNum,
            precio_venta: parseFloat(precioVenta),
            moneda: monedaProducto,
            estado: "disponible",
          },
        ])
        .select()
        .single();

      if (errorProd) throw errorProd;

      const { error: errorTx } = await supabase
        .from("inventario_transacciones")
        .insert([
          {
            producto_id: productoInsertado.id,
            caja_id: cajaCompraId,
            tipo: "compra",
            monto: costoCompraNum,
            moneda: cajaSeleccionada.moneda,
            registrado_por_cedula: cedulaAdminActual,
          },
        ]);

      if (errorTx) throw errorTx;

      const saldoActualNum = parseFloat(cajaSeleccionada.saldo_actual) || 0;
      const nuevoSaldo = saldoActualNum - costoCompraNum;

      const { error: errorCaja } = await supabase
        .from("cajas_bancos")
        .update({ saldo_actual: nuevoSaldo })
        .eq("id", cajaCompraId);

      if (errorCaja) throw errorCaja;

      Alert.alert("Éxito", "Producto registrado correctamente.");
      setModalVisible(false);
      cargarProductos();
      cargarCajas();
    } catch (error: any) {
      Alert.alert("Error", error.message || JSON.stringify(error));
    }
  };

  const abrirModalVenta = (producto: any) => {
    setProductoSeleccionado(producto);
    setMonedaVenta(producto.moneda || "USD");
    setMontoVenta(
      producto.precio_venta ? producto.precio_venta.toString() : "",
    );

    // Limpiamos los campos anteriores
    setClienteIdSeleccionado("");
    setBusquedaCliente("");
    setTipoTransaccion("contado");
    setAbonoInicial("");
    setNumeroCuotas("1");
    setFrecuenciaCuota("Mensual");

    // Filtramos y seleccionamos la primera caja por defecto según la moneda del producto
    const cajasDisponibles = cajas.filter(
      (c) => c.moneda === (producto.moneda || "USD"),
    );
    if (cajasDisponibles.length > 0) {
      setCajaIdSeleccionada(cajasDisponibles[0].id);
    } else {
      setCajaIdSeleccionada("");
    }

    cargarClientes();
    cargarCajas();
    setModalVentaVisible(true);
  };

  const ejecutarVenta = async () => {
    console.log("--- INICIANDO EJECUTAR VENTA ---");
    console.log("Cliente seleccionado:", clienteSeleccionado);
    console.log("Caja ID seleccionada:", cajaIdSeleccionada);
    console.log("Tipo de transacción:", tipoTransaccion);
    console.log("Monto venta:", montoVenta);

    try {
      const montoTotalVenta = parseFloat(montoVenta);
      let saldoPendiente = 0;

      const cajaSeleccionada = cajas.find((c) => c.id === cajaSeleccionadaId);

      // Validamos que la caja y el cliente seleccionado existan
      if (!cajaSeleccionada || !clienteSeleccionado) {
        Alert.alert(
          "Error",
          "Por favor seleccione una caja y un cliente válidos.",
        );
        return;
      }

      if (tipoTransaccion === "contado") {
        saldoPendiente = 0;

        const { error: errorTx } = await supabase
          .from("inventario_transacciones")
          .insert([
            {
              producto_id: productoSeleccionado.id,
              caja_id: cajaIdSeleccionada,
              cliente_id: clienteSeleccionado.id, // Usamos el ID del cliente seleccionado
              tipo: "venta",
              monto: montoTotalVenta,
              moneda: cajaSeleccionada.moneda,
              registrado_por_cedula: cedulaAdminActual,
            },
          ]);

        if (errorTx) throw errorTx;

        const saldoActualNum = parseFloat(cajaSeleccionada.saldo_actual) || 0;
        const nuevoSaldo = saldoActualNum + montoTotalVenta;

        const { error: errorCaja } = await supabase
          .from("cajas_bancos")
          .update({ saldo_actual: nuevoSaldo })
          .eq("id", cajaIdSeleccionada);

        if (errorCaja) throw errorCaja;
      } else {
        const abono = parseFloat(abonoInicial) || 0;
        saldoPendiente = montoTotalVenta - abono;
        const cuotasNum = parseInt(numeroCuotas) || 1;

        if (abono > montoTotalVenta) {
          Alert.alert(
            "Error",
            "El abono inicial no puede ser mayor al monto total.",
          );
          return;
        }

        const valorCuotaCalculado =
          cuotasNum > 0 ? saldoPendiente / cuotasNum : saldoPendiente;

        const { error: errorCredito } = await supabase
          .from("prestamos")
          .insert([
            {
              cedula: clienteSeleccionado.cedula,
              moneda: monedaVenta,
              monto_prestado: montoTotalVenta,
              monto_total: montoTotalVenta,
              saldo_pendiente: saldoPendiente,
              tasa_interes: 0,
              frecuencia: frecuenciaCuota,
              cuotas: cuotasNum,
              valor_cuota: valorCuotaCalculado,
              estado: saldoPendiente <= 0 ? "pagado" : "activo",
              tipo_prestamo: "venta a crédito",
              producto_id: productoSeleccionado.id,
              caja_id: cajaIdSeleccionada,
              registrado_por_cedula: cedulaAdminActual,
            },
          ]);

        if (errorCredito) throw errorCredito;

        const { error: errorTxCredito } = await supabase
          .from("inventario_transacciones")
          .insert([
            {
              producto_id: productoSeleccionado.id,
              caja_id: cajaIdSeleccionada,
              cliente_id: clienteSeleccionado.id,
              tipo: "venta_credito",
              monto: montoTotalVenta,
              moneda: cajaSeleccionada.moneda,
              registrado_por_cedula: cedulaAdminActual,
            },
          ]);

        if (errorTxCredito) throw errorTxCredito;

        if (abono > 0) {
          const { error: errorTxAbono } = await supabase
            .from("inventario_transacciones")
            .insert([
              {
                producto_id: productoSeleccionado.id,
                caja_id: cajaIdSeleccionada,
                cliente_id: clienteSeleccionado.id,
                tipo: "abono_inicial",
                monto: abono,
                moneda: cajaSeleccionada.moneda,
                registrado_por_cedula: cedulaAdminActual,
              },
            ]);

          if (errorTxAbono) throw errorTxAbono;

          const saldoActualNum = parseFloat(cajaSeleccionada.saldo_actual) || 0;
          const nuevoSaldo = saldoActualNum + abono;

          const { error: errorCajaAbono } = await supabase
            .from("cajas_bancos")
            .update({ saldo_actual: nuevoSaldo })
            .eq("id", cajaIdSeleccionada);

          if (errorCajaAbono) throw errorCajaAbono;
        }
      }

      const nuevoEstadoProducto =
        tipoTransaccion === "contado" ? "vendido" : "activo";

      const { error: errorProd } = await supabase
        .from("productos")
        .update({ estado: nuevoEstadoProducto })
        .eq("id", productoSeleccionado.id);

      if (errorProd) throw errorProd;

      Alert.alert("¡Éxito!", "Operación de venta registrada correctamente.");
      setModalVentaVisible(false);
      cargarProductos();
      cargarCajas();
    } catch (error: any) {
      console.error("Error detallado:", error);
      Alert.alert("Error al procesar", error.message || JSON.stringify(error));
    }
  };

  const abrirModalPago = async (producto: any) => {
    try {
      let { data: prestamoData } = await supabase
        .from("prestamos")
        .select("*")
        .eq("producto_id", producto.id)
        .maybeSingle();

      if (!prestamoData) {
        const { data: txData } = await supabase
          .from("inventario_transacciones")
          .select("cliente_id")
          .eq("producto_id", producto.id)
          .maybeSingle();

        if (txData?.cliente_id) {
          const { data: cliData } = await supabase
            .from("clientes")
            .select("cedula")
            .eq("id", txData.cliente_id)
            .maybeSingle();

          if (cliData?.cedula) {
            const { data: prestamoCedula } = await supabase
              .from("prestamos")
              .select("*")
              .eq("cedula", cliData.cedula)
              .eq("estado", "activo")
              .maybeSingle();

            prestamoData = prestamoCedula;
          }
        }
      }

      if (!prestamoData) {
        prestamoData = {
          id: null,
          monto_total: producto.precio_venta,
          saldo_pendiente: producto.precio_venta,
          moneda: producto.moneda || "USD",
          cedula: "N/A",
        };
      }

      setProductoPagoSeleccionado(producto);
      setPrestamoAsociado(prestamoData);
      setMontoAbono("");
      setCajaPagoId("");
      cargarCajas();
      setModalPagoVisible(true);
    } catch (e) {
      setProductoPagoSeleccionado(producto);
      setPrestamoAsociado({
        id: null,
        monto_total: producto.precio_venta,
        saldo_pendiente: producto.precio_venta,
        moneda: producto.moneda || "USD",
      });
      setModalPagoVisible(true);
    }
  };

  const registrarPagoCredito = async () => {
    if (!montoAbono || parseFloat(montoAbono) <= 0) {
      Alert.alert("Error", "Ingresa un monto de pago válido.");
      return;
    }
    if (!cajaPagoId) {
      Alert.alert(
        "Atención",
        "Selecciona una caja o banco para recibir el pago.",
      );
      return;
    }

    try {
      const montoAbonarNum = parseFloat(montoAbono);
      const saldoActualPrestamo =
        parseFloat(prestamoAsociado?.saldo_pendiente) ||
        parseFloat(productoPagoSeleccionado.precio_venta) ||
        0;

      if (montoAbonarNum > saldoActualPrestamo) {
        Alert.alert("Error", "El monto ingresado es mayor al saldo pendiente.");
        return;
      }

      const nuevoSaldoPrestamo = saldoActualPrestamo - montoAbonarNum;
      const nuevoEstadoPrestamo = nuevoSaldoPrestamo <= 0 ? "pagado" : "activo";

      // 1. Actualizar el préstamo
      if (prestamoAsociado?.id) {
        await supabase
          .from("prestamos")
          .update({
            saldo_pendiente: nuevoSaldoPrestamo,
            estado: nuevoEstadoPrestamo,
          })
          .eq("id", prestamoAsociado.id);
      }

      // 2. Si se pagó todo, actualizar el estado del producto a "pagado"
      if (nuevoEstadoPrestamo === "pagado" && productoPagoSeleccionado) {
        await supabase
          .from("productos")
          .update({ estado: "pagado" })
          .eq("id", productoPagoSeleccionado.id);
      }

      let clienteId = null;
      const { data: txInfo } = await supabase
        .from("inventario_transacciones")
        .select("cliente_id")
        .eq("producto_id", productoPagoSeleccionado?.id)
        .maybeSingle();
      if (txInfo) clienteId = txInfo.cliente_id;

      const cajaSeleccionada = cajas.find((c) => c.id === cajaPagoId);

      // 3. Registrar la transacción del abono
      await supabase.from("inventario_transacciones").insert([
        {
          producto_id: productoPagoSeleccionado?.id || null,
          caja_id: cajaPagoId,
          cliente_id: clienteId,
          tipo: "abono",
          monto: montoAbonarNum,
          moneda: cajaSeleccionada?.moneda || "USD",
          registrado_por_cedula: cedulaAdminActual,
        },
      ]);

      // 4. Actualizar saldo de la caja o banco
      const saldoCajaNum = parseFloat(cajaSeleccionada?.saldo_actual) || 0;
      const nuevoSaldoCaja = saldoCajaNum + montoAbonarNum;

      await supabase
        .from("cajas_bancos")
        .update({ saldo_actual: nuevoSaldoCaja })
        .eq("id", cajaPagoId);

      Alert.alert("¡Éxito!", "Pago registrado correctamente en caja y bancos.");
      setModalPagoVisible(false);
      cargarProductos();
      cargarCajas();
    } catch (error: any) {
      Alert.alert("Error", error.message || JSON.stringify(error));
    }
  };

  const clientesFiltrados = clientes.filter((c) => {
    const texto = busquedaCliente.toLowerCase();
    const nombreCompleto =
      `${c.nombres || ""} ${c.apellidos || ""}`.toLowerCase();
    const cedulaStr = String(c.cedula || "").toLowerCase();
    return nombreCompleto.includes(texto) || cedulaStr.includes(texto);
  });

  const cargarDetallesVenta = async (producto: any) => {
    try {
      const { data: txData } = await supabase
        .from("inventario_transacciones")
        .select("cliente_id, tipo, monto")
        .eq("producto_id", producto.id)
        .in("tipo", ["venta", "venta_credito"])
        .maybeSingle();

      let nombreCliente = "Sin cliente asignado";
      let tipoOperacion = "VENTA AL CONTADO";
      let clienteCedula = null;

      if (txData?.cliente_id) {
        const { data: cliData } = await supabase
          .from("clientes")
          .select("nombres, apellidos, cedula")
          .eq("id", txData.cliente_id)
          .maybeSingle();
        if (cliData) {
          nombreCliente = `${cliData.nombres} ${cliData.apellidos}`;
          clienteCedula = cliData.cedula;
        }
        if (txData.tipo === "venta_credito") {
          tipoOperacion = "VENTA A CRÉDITO";
        }
      }

      let { data: prestamoData } = await supabase
        .from("prestamos")
        .select("id, monto_total, saldo_pendiente")
        .eq("producto_id", producto.id)
        .maybeSingle();

      if (!prestamoData && clienteCedula) {
        const { data: prestamoCli } = await supabase
          .from("prestamos")
          .select("id, monto_total, saldo_pendiente")
          .eq("cedula", clienteCedula)
          .maybeSingle();
        prestamoData = prestamoCli;
      }

      const { data: abonosTx } = await supabase
        .from("inventario_transacciones")
        .select("monto, tipo")
        .eq("producto_id", producto.id)
        .in("tipo", ["venta", "abono_inicial", "abono"]);

      let totalIngresado = abonosTx
        ? abonosTx.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0)
        : 0;

      if (prestamoData?.id) {
        const { data: pagosPrestamo } = await supabase
          .from("pagos")
          .select("monto_pagado")
          .eq("prestamo_id", prestamoData.id);

        if (pagosPrestamo && pagosPrestamo.length > 0) {
          const totalPagosTabla = pagosPrestamo.reduce(
            (acc, curr) => acc + (parseFloat(curr.monto_pagado) || 0),
            0,
          );
          if (totalIngresado === 0) {
            totalIngresado = totalPagosTabla;
          }
        }
      }

      if (tipoOperacion === "VENTA AL CONTADO" && totalIngresado === 0) {
        totalIngresado = parseFloat(producto.precio_venta) || 0;
      }

      const precioCompraNum = parseFloat(producto.precio_compra) || 0;
      const precioVentaNum = parseFloat(producto.precio_venta) || 0;

      // Ganancia neta calculada evitando números negativos (si es menor o igual a compra, se queda en 0)
      let gananciaCalculada = totalIngresado - precioCompraNum;
      let gananciaNeta = gananciaCalculada > 0 ? gananciaCalculada : 0;

      setDetallesPrestamo({
        nombreProducto: producto.nombre,
        nombreCliente,
        tipoOperacion,
        moneda: producto.moneda || "USD",
        precioCompra: precioCompraNum,
        precioVenta: precioVentaNum,
        totalIngresado,
        gananciaNeta,
      });

      setModalDetallesVisible(true);
    } catch (error) {
      console.error("Error al cargar detalles:", error);
      Alert.alert("Error", "No se pudieron cargar los detalles de la venta.");
    }
  };

  return (
    <ScrollView
      style={styles.mainScrollContainer}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Gestión de Inventario</Text>
          <TouchableOpacity style={styles.addButton} onPress={abrirModalCrear}>
            <Text style={styles.addButtonText}>+ Nuevo Activo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridContainer}>
          {productos.map((item) => {
            const pCompra = Number(item.precio_compra) || 0;
            const pVenta = Number(item.precio_venta) || 0;
            const ganancia = pVenta - pCompra;

            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.nombre}</Text>
                <Text style={styles.cardSubtitle}>
                  Categoría: {item.categoria}
                </Text>

                <Text style={styles.cardText}>
                  Compra: {item.moneda} {item.precio_compra}
                </Text>
                <Text style={styles.cardText}>
                  Venta: {item.moneda} {item.precio_venta}
                </Text>

                <Text
                  style={[
                    styles.cardText,
                    { fontWeight: "bold", color: "#090528" },
                  ]}
                >
                  Ganancia estimada: {item.moneda} {ganancia.toFixed(2)}
                </Text>

                <Text
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        item.estado === "disponible"
                          ? "#28a745"
                          : item.estado === "activo"
                            ? "#d9534f"
                            : "#333",
                    },
                  ]}
                >
                  {item.estado.toUpperCase()}
                </Text>

                <View style={styles.rowButtonsCard}>
                  {item.estado === "disponible" ? (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: colors.accentBlue || "#007AFF",
                          width: "100%",
                        },
                      ]}
                      onPress={() => abrirModalVenta(item)}
                    >
                      <Text style={styles.btnText}>Vender / Dar Crédito</Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.actionBtnSmall,
                          { backgroundColor: "#007AFF", marginRight: 8 },
                        ]}
                        onPress={() => cargarDetallesVenta(item)}
                      >
                        <Text style={styles.btnText}>Ver Detalles</Text>
                      </TouchableOpacity>
                      {item.estado === "activo" && (
                        <TouchableOpacity
                          style={[
                            styles.actionBtnSmall,
                            { backgroundColor: "#28a745" },
                          ]}
                          onPress={() => abrirModalPago(item)}
                        >
                          <Text style={styles.btnText}>Registrar Pago</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Modal Detalles de la Venta */}
        <Modal
          visible={modalDetallesVisible}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <View style={styles.modalContentWhite}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 15,
                  }}
                >
                  <Text style={styles.modalTitleDark}>
                    Detalles de la Venta
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalDetallesVisible(false)}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "bold",
                        color: "#666",
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>

                {detallesPrestamo && (
                  <>
                    <View style={styles.badgeTypeContainer}>
                      <Text style={styles.badgeTypeText}>
                        {detallesPrestamo.tipoOperacion}
                      </Text>
                    </View>

                    <View style={styles.boxInfoCard}>
                      <Text style={styles.infoLabel}>
                        Producto:{" "}
                        <Text style={{ fontWeight: "normal" }}>
                          {detallesPrestamo.nombreProducto}
                        </Text>
                      </Text>
                      <Text style={styles.infoLabel}>
                        Cliente:{" "}
                        <Text style={{ fontWeight: "normal" }}>
                          {detallesPrestamo.nombreCliente}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.rowDetailLine}>
                      <Text style={styles.rowDetailTextLabel}>
                        Precio de Compra:
                      </Text>
                      <Text style={styles.rowDetailTextVal}>
                        $ {detallesPrestamo.precioCompra.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.rowDetailLine}>
                      <Text style={styles.rowDetailTextLabel}>
                        Precio de Venta:
                      </Text>
                      <Text style={styles.rowDetailTextVal}>
                        $ {detallesPrestamo.precioVenta.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.rowDetailLine}>
                      <Text style={styles.rowDetailTextLabel}>
                        Total Ingresado (Abonos):
                      </Text>
                      <Text
                        style={[styles.rowDetailTextVal, { color: "#007AFF" }]}
                      >
                        $ {detallesPrestamo.totalIngresado.toFixed(2)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.rowDetailLine,
                        { borderBottomWidth: 0, marginTop: 4, paddingTop: 8 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowDetailTextLabel,
                          { fontWeight: "bold", fontSize: 16, color: "#111" },
                        ]}
                      >
                        Ganancia Neta Actual:
                      </Text>
                      <Text
                        style={[
                          styles.rowDetailTextVal,
                          {
                            fontWeight: "bold",
                            fontSize: 16,
                            color:
                              detallesPrestamo.gananciaNeta >= 0
                                ? "#28a745"
                                : "#d9534f",
                          },
                        ]}
                      >
                        $ {detallesPrestamo.gananciaNeta.toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={styles.closeBtnModalDark}
                  onPress={() => setModalDetallesVisible(false)}
                >
                  <Text style={styles.saveButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal Crear Producto */}
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <View style={styles.modalContentWhite}>
                <Text style={styles.modalTitleDark}>
                  Registrar Producto o Activo
                </Text>
                <TextInput
                  style={styles.inputLight}
                  placeholder="Nombre"
                  placeholderTextColor="#888"
                  value={nombre}
                  onChangeText={setNombre}
                />
                <TextInput
                  style={styles.inputLight}
                  placeholder="Categoría"
                  placeholderTextColor="#888"
                  value={categoria}
                  onChangeText={setCategoria}
                />
                <TextInput
                  style={styles.inputLight}
                  placeholder="Precio de Compra"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={precioCompra}
                  onChangeText={setPrecioCompra}
                />
                <TextInput
                  style={styles.inputLight}
                  placeholder="Precio de Venta"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={precioVenta}
                  onChangeText={setPrecioVenta}
                />

                <Text style={styles.labelSection}>Moneda</Text>
                <View style={styles.rowMoneda}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      monedaProducto === "USD" && styles.optionButtonCardActive,
                      { marginRight: 10 },
                    ]}
                    onPress={() => setMonedaProducto("USD")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        monedaProducto === "USD" && styles.optionTextCardActive,
                      ]}
                    >
                      USD
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      monedaProducto === "COP" && styles.optionButtonCardActive,
                    ]}
                    onPress={() => setMonedaProducto("COP")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        monedaProducto === "COP" && styles.optionTextCardActive,
                      ]}
                    >
                      COP
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.labelSection}>Caja / Banco:</Text>
                {cajas
                  .filter((caja) => caja.moneda === monedaSeleccionada)
                  .map((caja) => {
                    const isSelected = cajaIdSeleccionada === caja.id; // Verifica que este nombre coincida
                    return (
                      <TouchableOpacity
                        key={caja.id}
                        style={[
                          styles.optionButtonCardSingle,
                          isSelected && styles.optionButtonCardActive,
                        ]}
                        onPress={() => setCajaIdSeleccionada(caja.id)} // <--- ¡Asegúrate de que sea este nombre!
                      >
                        <Text
                          style={[
                            styles.optionTextCard,
                            isSelected && styles.optionTextCardActive,
                          ]}
                        >
                          {caja.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={registrarProducto}
                >
                  <Text style={styles.saveButtonText}>Guardar Producto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButtonLight}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonTextLight}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* 1. BOTÓN Y MODAL PRINCIPAL DE GESTIÓN DE SALIDA / VENTA */}
        <Modal
          visible={modalVentaVisible}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <View style={styles.modalContentWhite}>
                <Text style={styles.modalTitleDark}>Gestión de Salida</Text>
                <Text style={styles.cardSubtitle}>
                  Ítem: {productoSeleccionado?.nombre}
                </Text>

                {/* Tipo de Operación */}
                <Text style={styles.labelSection}>Tipo de Operación:</Text>
                <View style={styles.rowMoneda}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      tipoOperacion === "contado" &&
                        styles.optionButtonCardActive,
                    ]}
                    onPress={() => setTipoOperacion("contado")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        tipoOperacion === "contado" &&
                          styles.optionTextCardActive,
                      ]}
                    >
                      Contado
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      tipoOperacion === "credito" &&
                        styles.optionButtonCardActive,
                    ]}
                    onPress={() => setTipoOperacion("credito")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        tipoOperacion === "credito" &&
                          styles.optionTextCardActive,
                      ]}
                    >
                      A Crédito
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Precio del Producto */}
                <View style={styles.boxInfoCard}>
                  <Text style={styles.infoLabel}>
                    Precio de Venta Establecido:
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "bold",
                      color: "#28a745",
                    }}
                  >
                    ${" "}
                    {parseFloat(
                      productoSeleccionado?.precio_venta || 0,
                    ).toLocaleString()}{" "}
                    {monedaSeleccionada}
                  </Text>
                </View>

                {/* Abono inicial (Solo si es a Crédito) */}
                {tipoOperacion === "credito" && (
                  <>
                    <Text style={styles.labelSection}>
                      Monto a Abonar (Inicial):
                    </Text>
                    <TextInput
                      style={styles.inputLight}
                      placeholder="Ej: 50"
                      placeholderTextColor="#888"
                      keyboardType="numeric"
                      value={montoAbono}
                      onChangeText={setMontoAbono}
                    />

                    <Text style={styles.labelSection}>Frecuencia de pago:</Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 12,
                      }}
                    >
                      {["diario", "semanal", "quincenal", "mensual"].map(
                        (freq) => (
                          <TouchableOpacity
                            key={freq}
                            style={[
                              styles.optionButtonCard,
                              frecuencia === freq &&
                                styles.optionButtonCardActive,
                            ]}
                            onPress={() => setFrecuencia(freq)}
                          >
                            <Text
                              style={[
                                styles.optionTextCard,
                                frecuencia === freq &&
                                  styles.optionTextCardActive,
                              ]}
                            >
                              {freq.charAt(0).toUpperCase() + freq.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ),
                      )}
                    </View>
                  </>
                )}

                {/* Moneda */}
                <Text style={styles.labelSection}>Moneda:</Text>
                <View style={styles.rowMoneda}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      monedaSeleccionada === "USD" &&
                        styles.optionButtonCardActive,
                    ]}
                    onPress={() => setMonedaSeleccionada("USD")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        monedaSeleccionada === "USD" &&
                          styles.optionTextCardActive,
                      ]}
                    >
                      USD
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonCard,
                      monedaSeleccionada === "COP" &&
                        styles.optionButtonCardActive,
                    ]}
                    onPress={() => setMonedaSeleccionada("COP")}
                  >
                    <Text
                      style={[
                        styles.optionTextCard,
                        monedaSeleccionada === "COP" &&
                          styles.optionTextCardActive,
                      ]}
                    >
                      COP
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* SELECTOR DE CLIENTE CON PICKER DESPLEGABLE */}
                <Text style={styles.labelSection}>Cliente Seleccionado:</Text>

                {/* Botón que abre el modal del selector */}
                <TouchableOpacity
                  style={styles.selectButtonElegante}
                  activeOpacity={0.8}
                  onPress={() => setModalClienteVisible(true)}
                >
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text
                      style={[
                        styles.selectButtonText,
                        !clienteSeleccionado && { color: "#999" },
                      ]}
                      numberOfLines={1}
                    >
                      {clienteSeleccionado
                        ? `${clienteSeleccionado.nombres} ${clienteSeleccionado.apellidos} (C.I.: ${clienteSeleccionado.cedula})`
                        : "Seleccionar Cliente..."}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Único Modal con las opciones */}
                <Modal
                  visible={modalClienteVisible}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setModalClienteVisible(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalClienteVisible(false)}
                  >
                    <View style={styles.modalContentCard}>
                      <View style={styles.modalHeaderTitle}>
                        <Text style={styles.modalTitleText}>
                          Seleccionar Cliente
                        </Text>
                        <TouchableOpacity
                          onPress={() => setModalClienteVisible(false)}
                        >
                          <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                      </View>

                      <ScrollView
                        contentContainerStyle={{ paddingVertical: 4 }}
                      >
                        {/* Opción por defecto / Limpiar */}
                        <TouchableOpacity
                          style={styles.modalItemOption}
                          onPress={() => {
                            setClienteSeleccionado(null);
                            setModalClienteVisible(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              { color: "#888", fontStyle: "italic" },
                            ]}
                          >
                            -- Ninguno / Seleccionar Cliente --
                          </Text>
                        </TouchableOpacity>

                        {clientesList.map((cli) => {
                          const isSelected = clienteSeleccionado?.id === cli.id;
                          return (
                            <TouchableOpacity
                              key={cli.id}
                              style={[
                                styles.modalItemOption,
                                isSelected && styles.modalItemOptionSelected,
                              ]}
                              onPress={() => {
                                setClienteSeleccionado(cli);
                                setModalClienteVisible(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.modalItemText,
                                  isSelected && styles.modalItemTextSelected,
                                ]}
                              >
                                {cli.nombres} {cli.apellidos}
                              </Text>
                              <Text
                                style={[
                                  styles.modalItemSubText,
                                  isSelected && styles.modalItemSubTextSelected,
                                ]}
                              >
                                C.I.: {cli.cedula}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* Modal o Lista desplegable bonita con las opciones */}
                <Modal
                  visible={modalClienteVisible}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setModalClienteVisible(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalClienteVisible(false)}
                  >
                    <View style={styles.modalContentCard}>
                      <View style={styles.modalHeaderTitle}>
                        <Text style={styles.modalTitleText}>
                          Seleccionar Cliente
                        </Text>
                        <TouchableOpacity
                          onPress={() => setModalClienteVisible(false)}
                        >
                          <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                      </View>

                      <ScrollView
                        contentContainerStyle={{ paddingVertical: 4 }}
                      >
                        {/* Opción por defecto / Limpiar */}
                        <TouchableOpacity
                          style={styles.modalItemOption}
                          onPress={() => {
                            setClienteSeleccionado(null);
                            setModalClienteVisible(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              { color: "#888", fontStyle: "italic" },
                            ]}
                          >
                            -- Ninguno / Seleccionar Cliente --
                          </Text>
                        </TouchableOpacity>

                        {clientesList.map((cli) => {
                          const isSelected = clienteSeleccionado?.id === cli.id;
                          return (
                            <TouchableOpacity
                              key={cli.id}
                              style={[
                                styles.modalItemOption,
                                isSelected && styles.modalItemOptionSelected,
                              ]}
                              onPress={() => {
                                setClienteSeleccionado(cli);
                                setModalClienteVisible(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.modalItemText,
                                  isSelected && styles.modalItemTextSelected,
                                ]}
                              >
                                {cli.nombres} {cli.apellidos}
                              </Text>
                              <Text
                                style={[
                                  styles.modalItemSubText,
                                  isSelected && styles.modalItemSubTextSelected,
                                ]}
                              >
                                C.I.: {cli.cedula}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* Caja / Banco receptora */}
                <Text style={styles.labelSection}>Caja / Banco receptora:</Text>
                {cajas
                  .filter((caja) => caja.moneda === monedaSeleccionada)
                  .map((caja) => {
                    const isSelected = cajaSeleccionadaId === caja.id;
                    return (
                      <TouchableOpacity
                        key={caja.id}
                        style={[
                          styles.optionButtonCardSingle,
                          isSelected && styles.optionButtonCardActive,
                        ]}
                        onPress={() => setCajaSeleccionadaId(caja.id)}
                      >
                        <Text
                          style={[
                            styles.optionTextCard,
                            isSelected && styles.optionTextCardActive,
                          ]}
                        >
                          {caja.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                {/* Botones de acción */}
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={ejecutarVenta}
                >
                  <Text style={styles.saveButtonText}>
                    Confirmar Transacción
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButtonLight}
                  onPress={() => setModalVentaVisible(false)}
                >
                  <Text style={styles.cancelButtonTextLight}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Modal Registrar Pago de Crédito */}
        <Modal
          visible={modalPagoVisible}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContainer}>
              <View style={styles.modalContentWhite}>
                <Text style={styles.modalTitleDark}>
                  Registrar Abono / Pago
                </Text>
                {prestamoAsociado && (
                  <>
                    <Text
                      style={{ color: "#333", marginBottom: 6, fontSize: 14 }}
                    >
                      Deuda total: {prestamoAsociado.moneda}{" "}
                      {prestamoAsociado.monto_total}
                    </Text>
                    <Text
                      style={{
                        color: "#d9534f",
                        marginBottom: 12,
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      Saldo pendiente: {prestamoAsociado.moneda}{" "}
                      {prestamoAsociado.saldo_pendiente}
                    </Text>
                  </>
                )}

                <TextInput
                  style={styles.inputLight}
                  placeholder="Monto a abonar"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={montoAbono}
                  onChangeText={setMontoAbono}
                />

                <Text style={styles.labelSection}>
                  Caja / Banco que recibe el dinero:
                </Text>
                {cajas
                  .filter((c) => c.moneda === prestamoAsociado?.moneda)
                  .map((caja) => (
                    <TouchableOpacity
                      key={caja.id}
                      style={[
                        styles.optionButtonCardSingle,
                        cajaPagoId === caja.id && styles.optionButtonCardActive,
                      ]}
                      onPress={() => setCajaPagoId(caja.id)}
                    >
                      <Text
                        style={[
                          styles.optionTextCard,
                          cajaPagoId === caja.id && styles.optionTextCardActive,
                        ]}
                      >
                        {caja.nombre} ({caja.saldo_actual})
                      </Text>
                    </TouchableOpacity>
                  ))}

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={registrarPagoCredito}
                >
                  <Text style={styles.saveButtonText}>Guardar Pago</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButtonLight}
                  onPress={() => setModalPagoVisible(false)}
                >
                  <Text style={styles.cancelButtonTextLight}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mainScrollContainer: { flex: 1, backgroundColor: "#f5f6fa" },
  contentContainer: { padding: 16, alignItems: "center" },
  container: { width: "100%", maxWidth: 800, alignSelf: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#333" },
  addButton: {
    backgroundColor: "#28a745",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "bold" },
  gridContainer: { width: "100%" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    width: "100%",
  },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  cardSubtitle: { fontSize: 14, color: "#666", marginBottom: 6 },
  cardText: { fontSize: 14, color: "#444", marginBottom: 4 },
  badge: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  rowButtonsCard: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: { paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  actionBtnSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalScrollContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  modalContentWhite: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 680,
    height: "80%",
    maxHeight: 650,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    display: "flex",
    flexDirection: "column",
  },
  modalTitleDark: { fontSize: 20, fontWeight: "bold", color: "#111" },
  modalScrollBody: { paddingRight: 4, paddingBottom: 10 },
  subInfoBanner: {
    backgroundColor: "#f1f3f5",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  subTitleModal: { fontSize: 15, fontWeight: "600", color: "#333" },
  inputLight: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    color: "#333",
    backgroundColor: "#f9f9f9",
    width: "100%",
  },
  labelSection: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
    marginTop: 6,
  },
  rowMoneda: { flexDirection: "row", marginBottom: 12, width: "100%" },
  optionButtonCard: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  optionButtonCardSingle: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    marginBottom: 8,
    width: "100%",
  },
  optionButtonCardActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  optionTextCard: { color: "#333", fontWeight: "bold" },
  optionTextCardActive: { color: "#fff" },
  saveButton: {
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
    width: "100%",
  },
  closeBtnModalDark: {
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
    width: "100%",
  },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelButtonLight: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  cancelButtonTextLight: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  badgeTypeContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#E3F2FD",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeTypeText: { color: "#007AFF", fontWeight: "bold", fontSize: 12 },
  boxInfoCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#fafafa",
    marginBottom: 15,
    width: "100%",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#444",
    marginBottom: 3,
  },
  rowDetailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    width: "100%",
  },
  rowDetailTextLabel: { fontSize: 14, color: "#555" },
  rowDetailTextVal: { fontSize: 14, fontWeight: "bold", color: "#222" },
  pickerContainerStylized: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 12,
    justifyContent: "center",
    height: 48, // Altura uniforme similar a tus inputs de texto
    overflow: "hidden",
  },
  pickerCustomStyle: {
    color: "#222",
    width: "100%",
    fontSize: 14,
    fontWeight: "500", // Letras un poco más definidas y estilizadas
  },
  selectButtonElegante: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectButtonText: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    width: "100%",
    maxWidth: 420,
    maxHeight: "75%",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeaderTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 10,
    marginBottom: 8,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  modalItemOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalItemOptionSelected: {
    backgroundColor: "#eff6ff",
  },
  modalItemText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  modalItemTextSelected: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  modalItemSubText: {
    fontSize: 12,
    color: "#6b7280",
  },
  modalItemSubTextSelected: {
    color: "#3b82f6",
  },
});
