// ==========================================
// CONEXIÓN CON SUPABASE & LÓGICA DE NEGOCIO
// ==========================================

// Inicialización corregida de la librería Supabase
const supabaseClient = window.supabase.createClient(CONFIGURACION.supabaseUrl, CONFIGURACION.supabaseAnonKey);

let movimientosGlobales = []; // Todo el histórico cargado desde la nube
let movimientosFiltrados = []; // Movimientos filtrados según el rango activo (Día/Mes/Todos)

document.addEventListener('DOMContentLoaded', async () => {
    aplicarConfiguraciones();
    await verificarSesion();

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) {
            alert("Error al iniciar sesión: " + error.message);
        } else {
            await verificarSesion();
        }
    });
});

function aplicarConfiguraciones() {
    document.getElementById('app-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('login-titulo').textContent = CONFIGURACION.nombreEmpresa;
    document.getElementById('app-subtitulo').textContent = CONFIGURACION.subtitulo;

    if (CONFIGURACION.logoUrl) {
        document.getElementById('app-logo').src = CONFIGURACION.logoUrl;
        document.getElementById('login-logo').src = CONFIGURACION.logoUrl;
        document.getElementById('app-logo').classList.remove('hidden');
        document.getElementById('login-logo').classList.remove('hidden');
    }
}

async function verificarSesion() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (session) {
        document.getElementById('modal-login').classList.add('hidden');
        document.getElementById('badge-rol').textContent = `Conectado: ${session.user.email}`;
        document.getElementById('badge-rol').className = "text-xs px-2.5 py-1 rounded-full bg-cyan-700 text-white font-semibold";
        await cargarDesdeSupabase();
    } else {
        document.getElementById('modal-login').classList.remove('hidden');
        document.getElementById('badge-rol').textContent = "Desconectado";
        document.getElementById('badge-rol').className = "text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-semibold";
    }
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    location.reload();
}

// Cargar registros desde la base de datos de Supabase
async function cargarDesdeSupabase() {
    const { data, error } = await supabaseClient
        .from('transacciones')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al obtener transacciones:", error);
        return;
    }

    movimientosGlobales = data || [];
    cambiarFiltroFecha(); // Aplica el filtro por defecto (Día de hoy)
}

// Filtra los movimientos
function cambiarFiltroFecha() {
    const opcion = document.getElementById('filtro-rango').value;
    const hoyStr = new Date().toISOString().split('T')[0];
    const mesActualStr = hoyStr.substring(0, 7); // AAAA-MM

    if (opcion === 'hoy') {
        movimientosFiltrados = movimientosGlobales.filter(m => m.fecha === hoyStr);
    } else if (opcion === 'mes') {
        movimientosFiltrados = movimientosGlobales.filter(m => m.fecha && m.fecha.startsWith(mesActualStr));
    } else {
        movimientosFiltrados = [...movimientosGlobales];
    }

    renderizarTablaYTotales();
}

// Formateador oficial COP
function formatearCOP(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(monto);
}

// Guardar Registro en la Nube
document.getElementById('form-movimiento').addEventListener('submit', async (e) => {
    e.preventDefault();

    const montoVal = parseFloat(document.getElementById('campo-monto').value.replace(/[$.,]/g, ''));
    if (isNaN(montoVal) || montoVal <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    const nuevoRegistro = {
        fecha: new Date().toISOString().split('T')[0],
        tipo: document.getElementById('campo-tipo').value,
        categoria: document.getElementById('campo-categoria').value,
        monto: montoVal,
        entidad: document.getElementById('campo-entidad').value || 'N/A',
        descripcion: document.getElementById('campo-descripcion').value
    };

    const { data, error } = await supabaseClient
        .from('transacciones')
        .insert([nuevoRegistro])
        .select();

    if (error) {
        alert("Error al guardar en la nube: " + error.message);
    } else {
        document.getElementById('form-movimiento').reset();
        await cargarDesdeSupabase();

        if (nuevoRegistro.tipo === 'ingreso' && data && data[0]) {
            setTimeout(() => {
                if (confirm("¿Deseas descargar el recibo individual en PDF?")) {
                    descargarFacturaPDF(data[0]);
                }
            }, 100);
        }
    }
});

// Eliminar Registro en la Nube
async function eliminarMovimiento(id) {
    if (!confirm("¿Deseas eliminar este registro contable de la base de datos?")) return;

    const { error } = await supabaseClient
        .from('transacciones')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        await cargarDesdeSupabase();
    }
}

// Renderizar Tabla y Métricas
function renderizarTablaYTotales() {
    const cuerpoTabla = document.getElementById('tabla-cuerpo');
    cuerpoTabla.innerHTML = '';

    let ingresos = 0;
    let egresos = 0;

    movimientosFiltrados.forEach(m => {
        const montoNum = parseFloat(m.monto) || 0;
        if (m.tipo === 'ingreso') ingresos += montoNum;
        if (m.tipo === 'egreso') egresos += montoNum;

        const fila = document.createElement('tr');
        fila.className = "hover:bg-slate-50 transition";

        const btnPDF = m.tipo === 'ingreso' 
            ? `<button onclick='descargarFacturaPDF(${JSON.stringify(m)})' class="text-cyan-700 hover:text-cyan-900 font-bold text-xs bg-cyan-50 px-2 py-1 rounded">PDF</button>` 
            : '';

        fila.innerHTML = `
            <td class="p-3 text-xs text-slate-500">${m.fecha}</td>
            <td class="p-3 font-semibold ${m.tipo === 'ingreso' ? 'text-cyan-600' : 'text-rose-600'}">
                ${m.tipo.toUpperCase()}
            </td>
            <td class="p-3 text-xs font-medium">${m.categoria}</td>
            <td class="p-3">
                <p class="font-medium text-xs">${m.descripcion}</p>
                ${m.entidad !== 'N/A' ? `<p class="text-xs text-indigo-500 font-medium">Ref: ${m.entidad}</p>` : ''}
            </td>
            <td class="p-3 text-right font-bold text-slate-800">${formatearCOP(montoNum)}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${btnPDF}
                    <button onclick="eliminarMovimiento(${m.id})" class="text-rose-600 hover:text-rose-800 font-bold text-xs">Eliminar</button>
                </div>
            </td>
        `;
        cuerpoTabla.appendChild(fila);
    });

    document.getElementById('total-ingresos').textContent = formatearCOP(ingresos);
    document.getElementById('total-egresos').textContent = formatearCOP(egresos);
    document.getElementById('balance-total').textContent = formatearCOP(ingresos - egresos);
}

// Descargar Recibo Individual en PDF (Incluye NIT)
function descargarFacturaPDF(movimiento) {
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("Error cargando librería PDF.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Franja de encabezado
    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 34, 'F');

    // Nombre de la empresa y NIT
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);
    doc.text("COMPROBANTE DE PAGO / RECIBO DE SERVICIO", 14, 28);

    // Número de recibo y fecha
    const numComprobante = movimiento.id.toString().padStart(6, '0');
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`N° Recibo: REC-${numComprobante}`, 145, 18);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${movimiento.fecha}`, 145, 26);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 40, 196, 40);

    // Detalle del Servicio
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Detalle del Servicio Atendido:", 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Categoría: ${movimiento.categoria}`, 14, 58);
    doc.text(`Descripción: ${movimiento.descripcion}`, 14, 66);
    doc.text(`Usuario / Remitente: ${movimiento.entidad}`, 14, 74);

    // Tabla de valor
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 84, 182, 8, 'F');

    doc.setFont("helvetica", "bold");
    doc.text("Concepto", 18, 89.5);
    doc.text("Monto Pagado", 150, 89.5);

    doc.setFont("helvetica", "normal");
    doc.text(movimiento.descripcion, 18, 100);
    doc.text(formatearCOP(movimiento.monto), 150, 100);

    doc.line(14, 107, 196, 107);

    // Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL PAGO: ${formatearCOP(movimiento.monto)}`, 130, 118);

    // Pie de página
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("Gracias por confiar en el Centro Integral DiversaMente.", 14, 142);

    doc.save(`Recibo_DiversaMente_REC-${numComprobante}.pdf`);
}

// Exportar Resumen Filtrado en PDF
function exportarResumenPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) return alert("Error cargando librería PDF.");
    if (movimientosFiltrados.length === 0) return alert("No hay movimientos en el rango seleccionado.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(183, 226, 225);
    doc.rect(0, 0, 210, 34, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(CONFIGURACION.nombreEmpresa, 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`NIT: ${CONFIGURACION.NIT}`, 14, 22);

    const rangoSel = document.getElementById('filtro-rango').selectedOptions[0].text;
    doc.text(`RESUMEN CONTABLE - Rango: ${rangoSel}`, 14, 28);

    doc.text(`Emisión: ${new Date().toLocaleDateString('es-CO')}`, 145, 22);
    doc.line(14, 40, 196, 40);

    let ingresos = 0;
    let egresos = 0;
    movimientosFiltrados.forEach(m => {
        if (m.tipo === 'ingreso') ingresos += parseFloat(m.monto);
        if (m.tipo === 'egreso') egresos += parseFloat(m.monto);
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Totales del Periodo Filtrado:", 14, 50);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 54, 182, 16, 'F');

    doc.setFontSize(9);
    doc.setTextColor(8, 145, 178);
    doc.text(`Ingresos: ${formatearCOP(ingresos)}`, 18, 64);

    doc.setTextColor(225, 29, 72);
    doc.text(`Egresos: ${formatearCOP(egresos)}`, 80, 64);

    doc.setTextColor(79, 70, 229);
    doc.text(`Balance: ${formatearCOP(ingresos - egresos)}`, 140, 64);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.text("Detalle de Transacciones:", 14, 80);

    doc.setFillColor(226, 232, 240);
    doc.rect(14, 84, 182, 8, 'F');
    doc.setFontSize(8);
    doc.text("FECHA", 17, 89.5);
    doc.text("TIPO", 38, 89.5);
    doc.text("CATEGORÍA", 58, 89.5);
    doc.text("DESCRIPCIÓN / USUARIO", 100, 89.5);
    doc.text("MONTO", 165, 89.5);

    let y = 98;
    doc.setFont("helvetica", "normal");

    movimientosFiltrados.forEach((m) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        doc.text(m.fecha, 17, y);
        doc.setTextColor(m.tipo === 'ingreso' ? 8 : 225, m.tipo === 'ingreso' ? 145 : 29, m.tipo === 'ingreso' ? 178 : 72);
        doc.text(m.tipo.toUpperCase(), 38, y);

        doc.setTextColor(30, 41, 59);
        doc.text(m.categoria.substring(0, 18), 58, y);
        doc.text(`${m.descripcion} (${m.entidad})`.substring(0, 32), 100, y);
        doc.text(formatearCOP(m.monto), 165, y);

        y += 7;
    });

    doc.save(`Resumen_Contable_${rangoSel.replace(/\s+/g, '_')}.pdf`);
}