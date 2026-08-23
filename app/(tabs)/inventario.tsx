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
  useWindowDimensions,
} from "react-native";
import { supabase } from "../../supabase";
import { colors } from "@/constants/globalStyles";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

// Función auxiliar para formatear números con separadores de miles y millones
const formatearMonedaInput = (valor: string) => {
  const soloNumeros = valor.replace(/\D/g, "");
  if (!soloNumeros) return "";
  const numero = parseInt(soloNumeros, 10);
  return numero.toLocaleString("en-US");
};

export default function InventarioScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [productos, setProductos] = useState<any[]>([]);
  const [cajas, setCajas] = useState<any[]>([]);
  const [cedulaAdminActual, setCedulaAdminActual] =
    useState<string>("00000000");

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
  const [clienteSeleccionadoId, setClienteSeleccionadoId] =
    useState<string>("");

  // Producto y datos de la venta
  const [productoSeleccionado, setProductoSeleccionado] = useState<any>(null);
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
      if (data.length > 0 && !clienteSeleccionadoId) {
        setClienteSeleccionadoId(data[0].id);
      }
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
      const costoCompraNum = parseFloat(precioCompra.replace(/,/g, "")) || 0;
      const precioVentaNum = parseFloat(precioVenta.replace(/,/g, "")) || 0;
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
            precio_venta: precioVentaNum,
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

    const precioVentaFormateado = producto.precio_venta
      ? Number(producto.precio_venta).toLocaleString("en-US")
      : "";
    setMontoVenta(precioVentaFormateado);

    setTipoTransaccion("contado");
    setAbonoInicial("");
    setNumeroCuotas("1");
    setFrecuenciaCuota("Mensual");

    cargarClientes();
    if (clientesList.length > 0) {
      setClienteSeleccionadoId(clientesList[0].id);
    }

    const cajasDisponibles = cajas.filter(
      (c) => c.moneda === (producto.moneda || "USD"),
    );
    if (cajasDisponibles.length > 0) {
      setCajaIdSeleccionada(cajasDisponibles[0].id);
    } else {
      setCajaIdSeleccionada("");
    }

    cargarCajas();
    setModalVentaVisible(true);
  };

  const ejecutarVenta = async () => {
    try {
      const montoTotalVenta = parseFloat(montoVenta.replace(/,/g, "")) || 0;
      let saldoPendiente = 0;

      const cajaSeleccionada = cajas.find((c) => c.id === cajaIdSeleccionada);
      const clienteSeleccionado = clientesList.find(
        (c) => c.id === clienteSeleccionadoId,
      );

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
              cliente_id: clienteSeleccionado.id,
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
        const abono = parseFloat(abonoInicial.replace(/,/g, "")) || 0;
        saldoPendiente = montoTotalVenta - abono;
        const cuotasNum = parseInt(numeroCuotas.replace(/,/g, "")) || 1;

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
      Alert.alert("Error al procesar", error.message || JSON.stringify(error));
    }
  };

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

      if (tipoOperacion === "VENTA AL CONTADO" && totalIngresado === 0) {
        totalIngresado = parseFloat(producto.precio_venta) || 0;
      }

      const precioCompraNum = parseFloat(producto.precio_compra) || 0;
      const precioVentaNum = parseFloat(producto.precio_venta) || 0;

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

  const abrirModalPago = async (producto: any) => {
    try {
      let { data: prestamoData } = await supabase
        .from("prestamos")
        .select("*")
        .eq("producto_id", producto.id)
        .maybeSingle();

      setProductoPagoSeleccionado(producto);
      setPrestamoAsociado(
        prestamoData || {
          id: null,
          monto_total: producto.precio_venta,
          saldo_pendiente: producto.precio_venta,
          moneda: producto.moneda || "USD",
        },
      );
      setMontoAbono("");
      setCajaPagoId("");
      cargarCajas();
      setModalPagoVisible(true);
    } catch (e) {
      setProductoPagoSeleccionado(producto);
      setModalPagoVisible(true);
    }
  };

  const registrarPagoCredito = async () => {
    const montoAbonarLimpio = parseFloat(montoAbono.replace(/,/g, "")) || 0;
    if (!montoAbono || montoAbonarLimpio <= 0) {
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
      const saldoActualPrestamo =
        parseFloat(prestamoAsociado?.saldo_pendiente) ||
        parseFloat(productoPagoSeleccionado.precio_venta) ||
        0;

      if (montoAbonarLimpio > saldoActualPrestamo) {
        Alert.alert("Error", "El monto ingresado es mayor al saldo pendiente.");
        return;
      }

      const nuevoSaldoPrestamo = saldoActualPrestamo - montoAbonarLimpio;
      const nuevoEstadoPrestamo = nuevoSaldoPrestamo <= 0 ? "pagado" : "activo";

      if (prestamoAsociado?.id) {
        await supabase
          .from("prestamos")
          .update({
            saldo_pendiente: nuevoSaldoPrestamo,
            estado: nuevoEstadoPrestamo,
          })
          .eq("id", prestamoAsociado.id);
      }

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

      await supabase.from("inventario_transacciones").insert([
        {
          producto_id: productoPagoSeleccionado?.id || null,
          caja_id: cajaPagoId,
          cliente_id: clienteId,
          tipo: "abono",
          monto: montoAbonarLimpio,
          moneda: cajaSeleccionada?.moneda || "USD",
          registrado_por_cedula: cedulaAdminActual,
        },
      ]);

      const saldoCajaNum = parseFloat(cajaSeleccionada?.saldo_actual) || 0;
      const nuevoSaldoCaja = saldoCajaNum + montoAbonarLimpio;

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

  const isMobile = screenWidth < 768;

  return (
    <View style={styles.screenWrapper}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Gestión de Inventario</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={abrirModalCrear}
            >
              <Text style={styles.addButtonText}>+ Nuevo Activo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gridContainer}>
            {productos.map((item) => {
              const pCompra = Number(item.precio_compra) || 0;
              const pVenta = Number(item.precio_venta) || 0;
              const ganancia = pVenta - pCompra;

              return (
                <View
                  key={item.id}
                  style={[styles.card, { width: isMobile ? "100%" : "32%" }]}
                >
                  <Text style={styles.cardTitle}>{item.nombre}</Text>
                  <Text style={styles.cardSubtitle}>
                    Categoría: {item.categoria}
                  </Text>

                  <Text style={styles.cardText}>
                    Compra: {item.moneda} {pCompra.toLocaleString("en-US")}
                  </Text>
                  <Text style={styles.cardText}>
                    Venta: {item.moneda} {pVenta.toLocaleString("en-US")}
                  </Text>

                  <Text
                    style={[
                      styles.cardText,
                      { fontWeight: "bold", color: "#090528", marginTop: 4 },
                    ]}
                  >
                    Ganancia estimada: {item.moneda}{" "}
                    {ganancia.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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

          {/* MODAL CREAR PRODUCTO */}
          <Modal visible={modalVisible} animationType="fade" transparent={true}>
            <View style={styles.modalCenteredOverlay}>
              <View
                style={[
                  styles.modalCompactContainer,
                  { maxWidth: isMobile ? "92%" : 480 },
                ]}
              >
                <View style={styles.modalHeaderFancy}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="cube-outline"
                      size={20}
                      color="#007AFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.modalTitleFancy}>
                      Registrar Nuevo Activo
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.closeIconButton}
                  >
                    <Ionicons name="close" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalBodyScroll}
                >
                  <View style={styles.inputGroupFancy}>
                    <Text style={styles.inputLabelSmall}>
                      Nombre del Producto
                    </Text>
                    <TextInput
                      style={styles.inputFancy}
                      placeholder="Ej. Teléfono, Moto..."
                      placeholderTextColor="#aaa"
                      value={nombre}
                      onChangeText={setNombre}
                    />
                  </View>

                  <View style={styles.inputGroupFancy}>
                    <Text style={styles.inputLabelSmall}>Categoría</Text>
                    <TextInput
                      style={styles.inputFancy}
                      placeholder="Ej. Tecnología"
                      placeholderTextColor="#aaa"
                      value={categoria}
                      onChangeText={setCategoria}
                    />
                  </View>

                  <View style={styles.rowInputsFancy}>
                    <View
                      style={[
                        styles.inputGroupFancy,
                        { flex: 1, marginRight: 6 },
                      ]}
                    >
                      <Text style={styles.inputLabelSmall}>Precio Compra</Text>
                      <TextInput
                        style={styles.inputFancy}
                        placeholder="0"
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                        value={precioCompra}
                        onChangeText={(text) =>
                          setPrecioCompra(formatearMonedaInput(text))
                        }
                      />
                    </View>
                    <View
                      style={[
                        styles.inputGroupFancy,
                        { flex: 1, marginLeft: 6 },
                      ]}
                    >
                      <Text style={styles.inputLabelSmall}>Precio Venta</Text>
                      <TextInput
                        style={styles.inputFancy}
                        placeholder="0"
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                        value={precioVenta}
                        onChangeText={(text) =>
                          setPrecioVenta(formatearMonedaInput(text))
                        }
                      />
                    </View>
                  </View>

                  <Text style={styles.sectionLabelFancy}>
                    Moneda de Operación
                  </Text>
                  <View style={styles.currencySelectorContainer}>
                    {["USD", "COP"].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.currencyOptionBtn,
                          monedaProducto === m &&
                            styles.currencyOptionBtnActive,
                        ]}
                        onPress={() => {
                          setMonedaProducto(m);
                          setCajaCompraId("");
                        }}
                      >
                        <Text
                          style={[
                            styles.currencyOptionText,
                            monedaProducto === m &&
                              styles.currencyOptionTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sectionLabelFancy}>
                    Caja / Banco (Débito de Compra)
                  </Text>
                  <View style={styles.cajasGridFancy}>
                    {cajas
                      .filter((c) => c.moneda === monedaProducto)
                      .map((caja) => {
                        const isSelected = cajaCompraId === caja.id;
                        return (
                          <TouchableOpacity
                            key={caja.id}
                            style={[
                              styles.cajaCardFancy,
                              isSelected && styles.cajaCardFancyActive,
                            ]}
                            onPress={() => setCajaCompraId(caja.id)}
                          >
                            <Ionicons
                              name={
                                caja.tipo === "banco"
                                  ? "business-outline"
                                  : "wallet-outline"
                              }
                              size={18}
                              color={isSelected ? "#007AFF" : "#666"}
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text
                                style={[
                                  styles.cajaCardTitle,
                                  isSelected && styles.cajaCardTitleActive,
                                ]}
                              >
                                {caja.nombre}
                              </Text>
                              <Text style={styles.cajaCardSaldo}>
                                Saldo: {caja.moneda}{" "}
                                {Number(caja.saldo_actual || 0).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color="#007AFF"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </ScrollView>

                <View style={styles.modalFooterFancy}>
                  <TouchableOpacity
                    style={styles.saveButtonFancy}
                    onPress={registrarProducto}
                  >
                    <Text style={styles.saveButtonTextFancy}>
                      Guardar Producto
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODAL VENDER / DAR CRÉDITO */}
          <Modal
            visible={modalVentaVisible}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.modalCenteredOverlay}>
              <View
                style={[
                  styles.modalCompactContainer,
                  { maxWidth: isMobile ? "92%" : 480 },
                ]}
              >
                <View style={styles.modalHeaderFancy}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="cart-outline"
                      size={20}
                      color="#007AFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.modalTitleFancy}>
                      Vender: {productoSeleccionado?.nombre}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVentaVisible(false)}
                    style={styles.closeIconButton}
                  >
                    <Ionicons name="close" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalBodyScroll}
                >
                  <Text style={styles.sectionLabelFancy}>
                    Tipo de Transacción
                  </Text>
                  <View style={styles.currencySelectorContainer}>
                    <TouchableOpacity
                      style={[
                        styles.currencyOptionBtn,
                        tipoTransaccion === "contado" &&
                          styles.currencyOptionBtnActive,
                      ]}
                      onPress={() => setTipoTransaccion("contado")}
                    >
                      <Text
                        style={[
                          styles.currencyOptionText,
                          tipoTransaccion === "contado" &&
                            styles.currencyOptionTextActive,
                        ]}
                      >
                        Contado
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.currencyOptionBtn,
                        tipoTransaccion === "credito" &&
                          styles.currencyOptionBtnActive,
                      ]}
                      onPress={() => setTipoTransaccion("credito")}
                    >
                      <Text
                        style={[
                          styles.currencyOptionText,
                          tipoTransaccion === "credito" &&
                            styles.currencyOptionTextActive,
                        ]}
                      >
                        Crédito
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionLabelFancy}>
                    Seleccionar Cliente
                  </Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={clienteSeleccionadoId}
                      onValueChange={(itemValue) =>
                        setClienteSeleccionadoId(itemValue)
                      }
                      style={styles.pickerStyle}
                    >
                      {clientesList.map((cli) => (
                        <Picker.Item
                          key={cli.id}
                          label={`${cli.nombres} ${cli.apellidos} (${cli.cedula})`}
                          value={cli.id}
                        />
                      ))}
                    </Picker>
                  </View>

                  <View style={styles.inputGroupFancy}>
                    <Text style={styles.inputLabelSmall}>
                      Monto Total ({monedaVenta})
                    </Text>
                    <TextInput
                      style={styles.inputFancy}
                      placeholder="0"
                      placeholderTextColor="#aaa"
                      keyboardType="numeric"
                      value={montoVenta}
                      onChangeText={(text) =>
                        setMontoVenta(formatearMonedaInput(text))
                      }
                    />
                  </View>

                  {tipoTransaccion === "credito" && (
                    <>
                      <View style={styles.inputGroupFancy}>
                        <Text style={styles.inputLabelSmall}>
                          Abono Inicial
                        </Text>
                        <TextInput
                          style={styles.inputFancy}
                          placeholder="0"
                          placeholderTextColor="#aaa"
                          keyboardType="numeric"
                          value={abonoInicial}
                          onChangeText={(text) =>
                            setAbonoInicial(formatearMonedaInput(text))
                          }
                        />
                      </View>
                      <View style={styles.rowInputsFancy}>
                        <View
                          style={[
                            styles.inputGroupFancy,
                            { flex: 1, marginRight: 6 },
                          ]}
                        >
                          <Text style={styles.inputLabelSmall}>
                            Nro. Cuotas
                          </Text>
                          <TextInput
                            style={styles.inputFancy}
                            placeholder="1"
                            placeholderTextColor="#aaa"
                            keyboardType="numeric"
                            value={numeroCuotas}
                            onChangeText={(text) =>
                              setNumeroCuotas(formatearMonedaInput(text))
                            }
                          />
                        </View>
                        <View
                          style={[
                            styles.inputGroupFancy,
                            { flex: 1, marginLeft: 6 },
                          ]}
                        >
                          <Text style={styles.inputLabelSmall}>Frecuencia</Text>
                          <TextInput
                            style={styles.inputFancy}
                            placeholder="Mensual"
                            placeholderTextColor="#aaa"
                            value={frecuenciaCuota}
                            onChangeText={setFrecuenciaCuota}
                          />
                        </View>
                      </View>
                    </>
                  )}

                  <Text style={styles.sectionLabelFancy}>
                    Caja / Banco (Recepción de Fondos)
                  </Text>
                  <View style={styles.cajasGridFancy}>
                    {cajas
                      .filter((c) => c.moneda === monedaVenta)
                      .map((caja) => {
                        const isSelected = cajaIdSeleccionada === caja.id;
                        return (
                          <TouchableOpacity
                            key={caja.id}
                            style={[
                              styles.cajaCardFancy,
                              isSelected && styles.cajaCardFancyActive,
                            ]}
                            onPress={() => setCajaIdSeleccionada(caja.id)}
                          >
                            <Ionicons
                              name={
                                caja.tipo === "banco"
                                  ? "business-outline"
                                  : "wallet-outline"
                              }
                              size={18}
                              color={isSelected ? "#007AFF" : "#666"}
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text
                                style={[
                                  styles.cajaCardTitle,
                                  isSelected && styles.cajaCardTitleActive,
                                ]}
                              >
                                {caja.nombre}
                              </Text>
                              <Text style={styles.cajaCardSaldo}>
                                Saldo: {caja.moneda}{" "}
                                {Number(caja.saldo_actual || 0).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color="#007AFF"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </ScrollView>

                <View style={styles.modalFooterFancy}>
                  <TouchableOpacity
                    style={styles.saveButtonFancy}
                    onPress={ejecutarVenta}
                  >
                    <Text style={styles.saveButtonTextFancy}>
                      Confirmar Venta
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODAL DETALLES VENTA */}
          <Modal
            visible={modalDetallesVisible}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.modalCenteredOverlay}>
              <View
                style={[
                  styles.modalCompactContainer,
                  { maxWidth: isMobile ? "92%" : 480 },
                ]}
              >
                <View style={styles.modalHeaderFancy}>
                  <Text style={styles.modalTitleFancy}>
                    Detalles de la Venta
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalDetallesVisible(false)}
                    style={styles.closeIconButton}
                  >
                    <Ionicons name="close" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalBodyScroll}
                >
                  {detallesPrestamo && (
                    <>
                      <View style={styles.badgeTypeContainer}>
                        <Text style={styles.badgeTypeText}>
                          {detallesPrestamo.tipoOperacion}
                        </Text>
                      </View>

                      <View style={styles.boxInfoCard}>
                        <Text style={styles.infoLabel}>
                          Producto: {detallesPrestamo.nombreProducto}
                        </Text>
                        <Text style={styles.infoLabel}>
                          Cliente: {detallesPrestamo.nombreCliente}
                        </Text>
                      </View>

                      <View style={styles.rowDetailLine}>
                        <Text style={styles.rowDetailTextLabel}>
                          Precio Compra:
                        </Text>
                        <Text style={styles.rowDetailTextVal}>
                          {detallesPrestamo.moneda}{" "}
                          {detallesPrestamo.precioCompra.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </Text>
                      </View>
                      <View style={styles.rowDetailLine}>
                        <Text style={styles.rowDetailTextLabel}>
                          Precio Venta:
                        </Text>
                        <Text style={styles.rowDetailTextVal}>
                          {detallesPrestamo.moneda}{" "}
                          {detallesPrestamo.precioVenta.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </Text>
                      </View>
                      <View style={styles.rowDetailLine}>
                        <Text style={styles.rowDetailTextLabel}>
                          Total Ingresado:
                        </Text>
                        <Text
                          style={[
                            styles.rowDetailTextVal,
                            { color: "#007AFF" },
                          ]}
                        >
                          {detallesPrestamo.moneda}{" "}
                          {detallesPrestamo.totalIngresado.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </Text>
                      </View>
                      <View
                        style={[styles.rowDetailLine, { borderBottomWidth: 0 }]}
                      >
                        <Text
                          style={[
                            styles.rowDetailTextLabel,
                            { fontWeight: "bold", color: "#111" },
                          ]}
                        >
                          Ganancia Neta:
                        </Text>
                        <Text
                          style={[
                            styles.rowDetailTextVal,
                            {
                              fontWeight: "bold",
                              color:
                                detallesPrestamo.gananciaNeta >= 0
                                  ? "#28a745"
                                  : "#d9534f",
                            },
                          ]}
                        >
                          {detallesPrestamo.moneda}{" "}
                          {detallesPrestamo.gananciaNeta.toLocaleString(
                            "en-US",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </Text>
                      </View>
                    </>
                  )}
                </ScrollView>

                <View style={styles.modalFooterFancy}>
                  <TouchableOpacity
                    style={styles.closeBtnModalDark}
                    onPress={() => setModalDetallesVisible(false)}
                  >
                    <Text style={styles.saveButtonTextFancy}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODAL REGISTRAR PAGO */}
          <Modal
            visible={modalPagoVisible}
            animationType="fade"
            transparent={true}
          >
            <View style={styles.modalCenteredOverlay}>
              <View
                style={[
                  styles.modalCompactContainer,
                  { maxWidth: isMobile ? "92%" : 480 },
                ]}
              >
                <View style={styles.modalHeaderFancy}>
                  <Text style={styles.modalTitleFancy}>
                    Registrar Abono o Pago
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalPagoVisible(false)}
                    style={styles.closeIconButton}
                  >
                    <Ionicons name="close" size={20} color="#333" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalBodyScroll}
                >
                  {productoPagoSeleccionado && prestamoAsociado && (
                    <View style={styles.boxInfoCard}>
                      <Text style={styles.infoLabel}>
                        Producto: {productoPagoSeleccionado.nombre}
                      </Text>
                      <Text style={styles.infoLabel}>
                        Saldo Pendiente: {prestamoAsociado.moneda}{" "}
                        {Number(
                          prestamoAsociado.saldo_pendiente || 0,
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </View>
                  )}

                  <View style={styles.inputGroupFancy}>
                    <Text style={styles.inputLabelSmall}>Monto a Abonar</Text>
                    <TextInput
                      style={styles.inputFancy}
                      placeholder="0"
                      placeholderTextColor="#aaa"
                      keyboardType="numeric"
                      value={montoAbono}
                      onChangeText={(text) =>
                        setMontoAbono(formatearMonedaInput(text))
                      }
                    />
                  </View>

                  <Text style={styles.sectionLabelFancy}>
                    Caja / Banco de Recepción
                  </Text>
                  <View style={styles.cajasGridFancy}>
                    {cajas
                      .filter(
                        (c) => c.moneda === (prestamoAsociado?.moneda || "USD"),
                      )
                      .map((caja) => {
                        const isSelected = cajaPagoId === caja.id;
                        return (
                          <TouchableOpacity
                            key={caja.id}
                            style={[
                              styles.cajaCardFancy,
                              isSelected && styles.cajaCardFancyActive,
                            ]}
                            onPress={() => setCajaPagoId(caja.id)}
                          >
                            <Ionicons
                              name={
                                caja.tipo === "banco"
                                  ? "business-outline"
                                  : "wallet-outline"
                              }
                              size={18}
                              color={isSelected ? "#007AFF" : "#666"}
                            />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text
                                style={[
                                  styles.cajaCardTitle,
                                  isSelected && styles.cajaCardTitleActive,
                                ]}
                              >
                                {caja.nombre}
                              </Text>
                              <Text style={styles.cajaCardSaldo}>
                                Saldo: {caja.moneda}{" "}
                                {Number(caja.saldo_actual || 0).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color="#007AFF"
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </ScrollView>

                <View style={styles.modalFooterFancy}>
                  <TouchableOpacity
                    style={styles.saveButtonFancy}
                    onPress={registrarPagoCredito}
                  >
                    <Text style={styles.saveButtonTextFancy}>
                      Confirmar Abono
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#111" },
  addButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 6,
  },
  cardSubtitle: { fontSize: 13, color: "#666", marginBottom: 10 },
  cardText: { fontSize: 14, color: "#333", marginBottom: 4 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    marginVertical: 10,
  },
  rowButtonsCard: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "bold" },

  modalCenteredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCompactContainer: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    display: "flex",
    flexDirection: "column",
  },
  modalHeaderFancy: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
    marginBottom: 10,
  },
  modalTitleFancy: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
  },
  closeIconButton: {
    backgroundColor: "#f1f1f1",
    padding: 4,
    borderRadius: 16,
  },
  modalBodyScroll: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  sectionLabelFancy: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#555",
    marginTop: 10,
    marginBottom: 4,
  },
  inputGroupFancy: {
    marginBottom: 8,
  },
  inputLabelSmall: {
    fontSize: 11,
    color: "#666",
    marginBottom: 2,
  },
  inputFancy: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111",
  },
  rowInputsFancy: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  currencySelectorContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  currencyOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  currencyOptionBtnActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  currencyOptionText: {
    fontWeight: "bold",
    color: "#555",
    fontSize: 13,
  },
  currencyOptionTextActive: {
    color: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e1e1e1",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    overflow: "hidden",
    marginBottom: 8,
  },
  pickerStyle: {
    height: 42,
    width: "100%",
    color: "#111",
    backgroundColor: "transparent",
  },
  cajasGridFancy: {
    gap: 6,
  },
  cajaCardFancy: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fcfcfc",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 8,
    borderRadius: 8,
  },
  cajaCardFancyActive: {
    borderColor: "#007AFF",
    backgroundColor: "#f0f6ff",
  },
  cajaCardTitle: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#333",
  },
  cajaCardTitleActive: {
    color: "#007AFF",
  },
  cajaCardSaldo: {
    fontSize: 10,
    color: "#777",
  },
  modalFooterFancy: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
    marginTop: 6,
  },
  saveButtonFancy: {
    backgroundColor: "#28a745",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonTextFancy: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  badgeTypeContainer: {
    backgroundColor: "#eef2ff",
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
    marginBottom: 10,
  },
  badgeTypeText: { color: "#007AFF", fontWeight: "bold", fontSize: 12 },
  boxInfoCard: {
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  infoLabel: {
    fontWeight: "bold",
    color: "#444",
    fontSize: 12,
    marginBottom: 2,
  },
  rowDetailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowDetailTextLabel: { fontSize: 13, color: "#555" },
  rowDetailTextVal: { fontSize: 13, fontWeight: "bold", color: "#111" },
  closeBtnModalDark: {
    backgroundColor: "#333",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
});
