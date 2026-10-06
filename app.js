// Supabase Configuration
const SUPABASE_URL = 'https://eqkkrcjdzdlhzwdnunoh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0pfomhywrBLPzaDVJ927HQ_TGTqRNfD';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Update user bar and auth buttons
async function actualizarUI() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const userEmail = document.getElementById('user-email');
    const authForms = document.getElementById('auth-forms');
    const btnLogout = document.getElementById('btn-logout');

    if (session) {
        if (userEmail) userEmail.textContent = `Active session: ${session.user.email}`;
        if (authForms) authForms.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
    } else {
        if (userEmail) userEmail.textContent = 'Sign in or register to save your data';
        if (authForms) authForms.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
    }
}

// Login / Signup Events
document.getElementById('btn-login')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert('Error signing in: ' + error.message);
    else {
        actualizarUI();
        cargarCategorias();
        refrescarDatosFiltrados();
    }
});

document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) alert('Error registering: ' + error.message);
    else alert('Registration complete! If confirmation is required, please check your email.');
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    actualizarUI();
    cargarCategorias();
    refrescarDatosFiltrados();
});

// Load Categories
async function cargarCategorias() {
    const { data, error } = await supabaseClient
        .from('categorias')
        .select('*')
        .order('nombre');

    if (error) return console.error('Error loading categories:', error);

    const lista = document.getElementById('lista-categorias');
    const selectCategoria = document.getElementById('categoria-transaccion');
    const selectPresupuesto = document.getElementById('categoria-presupuesto');

    if (lista) lista.innerHTML = '';
    if (selectCategoria) selectCategoria.innerHTML = '<option value="">No category</option>';
    if (selectPresupuesto) selectPresupuesto.innerHTML = '<option value="">Choose a category</option>';

    data?.forEach((cat) => {
        if (lista) {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-2 bg-gray-50 rounded border text-sm';
            li.innerHTML = `
                <span class="text-gray-700">${escaparHTML(cat.nombre)}</span>
                <button onclick="eliminarCategoria('${cat.id}')" class="text-red-500 hover:text-red-700 font-bold">Delete</button>
            `;
            lista.appendChild(li);
        }

        if (selectCategoria) {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            selectCategoria.appendChild(option);
        }

        if (selectPresupuesto) {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            selectPresupuesto.appendChild(option);
        }
    });
}

// Delete Category
window.eliminarCategoria = async (id) => {
    const { error } = await supabaseClient.from('categorias').delete().eq('id', id);
    if (error) {
        alert('Could not delete category: ' + error.message);
    } else {
        cargarCategorias();
        cargarPresupuestos();
    }
};

// Add Category
document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('nombre-categoria');
    const nombre = input.value.trim();

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('categorias').insert({
        nombre,
        user_id: user ? user.id : null
    });

    if (error) alert('Error inserting category: ' + error.message);
    else {
        input.value = '';
        cargarCategorias();
    }
});
// Escape user text before inserting it into HTML (prevents XSS)
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}
// First day of a month ("YYYY-MM") and first day of the next one
function rangoMes(mes) {
    const [anio, m] = mes.split('-').map(Number);
    const inicio = `${mes}-01`;
    const fin = m === 12 ? `${anio + 1}-01-01` : `${anio}-${String(m + 1).padStart(2, '0')}-01`;
    return [inicio, fin];
}

// Current month as "YYYY-MM"
function mesActual() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

// Month filter: if a month is selected ("YYYY-MM"), keep only transactions dated in that month
function filtrarPorMes(query) {
    const mes = document.getElementById('filtro-mes')?.value;
    if (!mes) return query;

    const [inicio, fin] = rangoMes(mes);
    return query.gte('fecha', inicio).lt('fecha', fin);
}

// Reload everything that depends on the transactions or the month filter
function refrescarDatosFiltrados() {
    cargarTransaccionesBD();
    actualizarTotalesBD();
    renderizarGraficoGastos();
    cargarPresupuestos();
}

// Load Budgets: spending vs. limit for the filtered month (or the current month when showing all)
async function cargarPresupuestos() {
    const lista = document.getElementById('lista-presupuestos');
    if (!lista) return;

    const mes = document.getElementById('filtro-mes')?.value || mesActual();
    const [inicio, fin] = rangoMes(mes);

    const etiqueta = document.getElementById('mes-presupuestos');
    if (etiqueta) {
        const [anio, m] = mes.split('-').map(Number);
        etiqueta.textContent = new Date(anio, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }

    const [presupuestosRes, gastosRes] = await Promise.all([
        supabaseClient.from('presupuestos').select('id, limite, categoria_id, categorias(nombre)'),
        supabaseClient.from('transacciones')
            .select('monto, categoria_id')
            .eq('tipo', 'Gasto')
            .gte('fecha', inicio)
            .lt('fecha', fin)
    ]);

    if (presupuestosRes.error) return console.error('Error loading budgets:', presupuestosRes.error);
    if (gastosRes.error) return console.error('Error loading budget spending:', gastosRes.error);

    // Total spent per category this month
    const gastadoPorCategoria = {};
    gastosRes.data.forEach((t) => {
        if (!t.categoria_id) return;
        gastadoPorCategoria[t.categoria_id] = (gastadoPorCategoria[t.categoria_id] || 0) + (parseFloat(t.monto) || 0);
    });

    lista.innerHTML = '';
    if (presupuestosRes.data.length === 0) {
        lista.innerHTML = '<li class="text-center text-gray-500 text-sm">No budgets yet. Choose a category and set a monthly limit.</li>';
        return;
    }

    const presupuestos = presupuestosRes.data
        .map((p) => ({ ...p, nombre: p.categorias ? p.categorias.nombre : '' }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    presupuestos.forEach((p) => {
        const limite = Number(p.limite);
        const gastado = gastadoPorCategoria[p.categoria_id] || 0;
        const porcentaje = (gastado / limite) * 100;

        // Green under 80%, amber from 80% to 100%, red when over budget
        let colorBarra = 'bg-emerald-500';
        let colorTexto = 'text-emerald-600';
        if (porcentaje > 100) {
            colorBarra = 'bg-red-500';
            colorTexto = 'text-red-600';
        } else if (porcentaje >= 80) {
            colorBarra = 'bg-amber-500';
            colorTexto = 'text-amber-600';
        }

        const restante = limite - gastado;
        const mensaje = restante >= 0
            ? `${restante.toFixed(2)} $ left`
            : `Over budget by ${Math.abs(restante).toFixed(2)} $`;

        const li = document.createElement('li');
        li.innerHTML = `
            <div class="flex justify-between items-center gap-3 text-sm mb-1">
                <span class="font-medium text-gray-700 min-w-0 break-words">${escaparHTML(p.nombre)}</span>
                <div class="flex items-center gap-1 shrink-0">
                    <span class="font-semibold whitespace-nowrap ${colorTexto}">${gastado.toFixed(2)} / ${limite.toFixed(2)} $</span>
                    <button onclick="eliminarPresupuesto('${p.id}')" class="p-2 rounded-lg hover:bg-gray-100 text-sm" title="Delete budget">🗑️</button>
                </div>
            </div>
            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all ${colorBarra}" style="width: ${Math.min(porcentaje, 100)}%"></div>
            </div>
            <p class="text-xs mt-1 ${restante >= 0 ? 'text-gray-400' : 'text-red-500 font-semibold'}">${mensaje}</p>
        `;
        lista.appendChild(li);
    });
}

// Set Budget: creates it, or updates the limit if the category already has one
document.getElementById('form-presupuesto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert('You must sign in to set budgets.');

    const categoria_id = document.getElementById('categoria-presupuesto').value;
    const limite = parseFloat(document.getElementById('limite-presupuesto').value);

    const { error } = await supabaseClient
        .from('presupuestos')
        .upsert({ user_id: user.id, categoria_id, limite }, { onConflict: 'user_id,categoria_id' });

    if (error) return alert('Error saving budget: ' + error.message);
    e.target.reset();
    cargarPresupuestos();
});

// Delete Budget
window.eliminarPresupuesto = async (id) => {
    const { error } = await supabaseClient.from('presupuestos').delete().eq('id', id);
    if (error) return alert('Could not delete budget: ' + error.message);
    cargarPresupuestos();
};

document.getElementById('filtro-mes')?.addEventListener('change', refrescarDatosFiltrados);
document.getElementById('btn-todos-meses')?.addEventListener('click', () => {
    document.getElementById('filtro-mes').value = '';
    refrescarDatosFiltrados();
});

// Transactions currently shown, by id (used to fill the form when editing)
let transaccionesPorId = {};
// Id of the transaction being edited (null = creating a new one)
let editandoId = null;

// Load Transactions
async function cargarTransaccionesBD() {
    const lista = document.getElementById('lista-transacciones');
    if (!lista) return;
    lista.innerHTML = '';

    const { data, error } = await filtrarPorMes(supabaseClient
        .from('transacciones')
        .select('*, categorias(nombre)'))
        .order('fecha', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) return console.error('Error loading transactions:', error);
    
    if (!data || data.length === 0) {
        const mensaje = document.getElementById('filtro-mes')?.value
            ? 'No transactions in this month.'
            : 'No transactions recorded yet.';
        lista.innerHTML = `<p class="p-4 text-center text-gray-500 text-sm">${mensaje}</p>`;
        return;
    }

    transaccionesPorId = {};
    data.forEach((t) => {
        transaccionesPorId[t.id] = t;
        const li = document.createElement('li');
        li.className = 'py-3 flex justify-between items-center gap-3 border-b border-gray-100';
        const esIngreso = t.tipo === 'Ingreso';
        const color = esIngreso ? 'text-green-600' : 'text-red-600';
        const signo = esIngreso ? '+' : '-';
        const catNombre = t.categorias ? t.categorias.nombre : 'No category';
        const fechaTransaccion = t.fecha ? new Date(t.fecha).toLocaleDateString() : '';

        li.innerHTML = `
            <div class="min-w-0">
                <p class="font-medium text-gray-800 text-sm break-words">${escaparHTML(t.concepto)}</p>
                <p class="text-xs text-gray-400">${escaparHTML(catNombre)} <span class="ml-2 text-gray-300">${fechaTransaccion}</span></p>
            </div>
            <div class="flex items-center gap-1 sm:gap-2 shrink-0">
                <span class="font-bold text-sm whitespace-nowrap mr-1 ${color}">${signo}${Number(t.monto).toFixed(2)} $</span>
                <button onclick="editarTransaccion('${t.id}')" class="p-2 rounded-lg hover:bg-gray-100 text-sm" title="Edit">✏️</button>
                <button onclick="eliminarTransaccion('${t.id}')" class="p-2 rounded-lg hover:bg-gray-100 text-sm" title="Delete">🗑️</button>
            </div>
        `;
        lista.appendChild(li);
    });
}
// Export the transactions currently shown to a CSV file (Spanish Excel format: ";" separator, decimal comma)
function exportarCSV() {
    const transacciones = Object.values(transaccionesPorId);
    if (transacciones.length === 0) return alert('There are no transactions to export.');

    // Quote every field; prefix text that Excel would run as a formula (=, +, -, @)
    const campo = (valor, esTexto = true) => {
        let texto = String(valor ?? '');
        if (esTexto && /^[=+\-@]/.test(texto)) texto = "'" + texto;
        return `"${texto.replace(/"/g, '""')}"`;
    };

    const filas = [['Date', 'Concept', 'Type', 'Category', 'Amount'].map((c) => campo(c)).join(';')];
    transacciones.forEach((t) => {
        const [anio, mes, dia] = (t.fecha ?? '').slice(0, 10).split('-');
        const fecha = t.fecha ? `${dia}/${mes}/${anio}` : '';
        const esIngreso = t.tipo === 'Ingreso';
        const importe = (esIngreso ? 1 : -1) * Number(t.monto);

        filas.push([
            campo(fecha),
            campo(t.concepto),
            campo(esIngreso ? 'Income' : 'Expense'),
            campo(t.categorias ? t.categorias.nombre : 'No category'),
            campo(importe.toFixed(2).replace('.', ','), false)
        ].join(';'));
    });

    // "﻿" tells Excel the file is UTF-8, so accents display correctly
    const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const mesFiltro = document.getElementById('filtro-mes')?.value;
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `transacciones-${mesFiltro || 'todas'}.csv`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

document.getElementById('btn-exportar-csv')?.addEventListener('click', exportarCSV);

// Edit Transaction: load its data into the form
window.editarTransaccion = (id) => {
    const t = transaccionesPorId[id];
    if (!t) return;

    editandoId = id;
    document.getElementById('concepto-transaccion').value = t.concepto ?? '';
    document.getElementById('monto-transaccion').value = t.monto;
    document.getElementById('fecha-transaccion').value = (t.fecha ?? '').slice(0, 10);
    document.getElementById('tipo-transaccion').value = t.tipo;
    document.getElementById('categoria-transaccion').value = t.categoria_id ?? '';

    document.getElementById('titulo-form-transaccion').textContent = 'Edit Transaction';
    document.getElementById('btn-guardar-transaccion').textContent = 'Update Transaction';
    document.getElementById('btn-cancelar-edicion').classList.remove('hidden');
    document.getElementById('form-transaccion').scrollIntoView({ behavior: 'smooth' });
};

// Cancel editing: back to "new transaction" mode
window.cancelarEdicion = () => {
    editandoId = null;
    document.getElementById('form-transaccion').reset();
    document.getElementById('titulo-form-transaccion').textContent = 'New Transaction';
    document.getElementById('btn-guardar-transaccion').textContent = 'Save Transaction';
    document.getElementById('btn-cancelar-edicion').classList.add('hidden');
};

// Delete Transaction
window.eliminarTransaccion = async (id) => {
    const { error } = await supabaseClient.from('transacciones').delete().eq('id', id);
    if (error) console.error('Error deleting transaction:', error);
    else {
        if (id === editandoId) cancelarEdicion();
        refrescarDatosFiltrados();
    }
};

// Save Transaction
document.getElementById('form-transaccion')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert('You must sign in with your email and password in the top bar to save transactions.');
        return;
    }

    const concepto = document.getElementById('concepto-transaccion').value;
    const monto = parseFloat(document.getElementById('monto-transaccion').value);
    const tipo = document.getElementById('tipo-transaccion').value;
    const categoria_id = document.getElementById('categoria-transaccion').value || null;
    const fecha = document.getElementById('fecha-transaccion').value;

    const datos = { concepto, monto, tipo, categoria_id, fecha };

    if (editandoId) {
        // Update the existing transaction
        const { data, error } = await supabaseClient
            .from('transacciones')
            .update(datos)
            .eq('id', editandoId)
            .select();

        if (error) return alert('Error updating transaction: ' + error.message);
        if (!data || data.length === 0) {
            return alert('The transaction was not updated. Check that the "transacciones" table has an UPDATE policy in Supabase.');
        }
        cancelarEdicion();
    } else {
        // Create a new transaction
        const { error } = await supabaseClient.from('transacciones').insert({
            ...datos,
            user_id: user.id
        });

        if (error) return alert('Error saving transaction: ' + error.message);
        e.target.reset();
    }

    refrescarDatosFiltrados();
});

// Update Totals (Income, Expenses, Balance)
async function actualizarTotalesBD() {
    const { data, error } = await filtrarPorMes(supabaseClient.from('transacciones').select('monto, tipo'));
    if (error) return console.error('Error fetching totals:', error);

    let ingresos = 0;
    let gastos = 0;

    data?.forEach((t) => {
        const monto = parseFloat(t.monto) || 0;
        if (t.tipo === 'Ingreso') ingresos += monto;
        else if (t.tipo === 'Gasto') gastos += monto;
    });

    const saldo = ingresos - gastos;

    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const saldoTotalEl = document.getElementById('saldo-total');

    if (totalIngresosEl) totalIngresosEl.textContent = `${Number(ingresos).toFixed(2)} $`;
    if (totalGastosEl) totalGastosEl.textContent = `${Number(gastos).toFixed(2)} $`;
    if (saldoTotalEl) saldoTotalEl.textContent = `${Number(saldo).toFixed(2)} $`;
}

// Listen to Auth State Changes
supabaseClient.auth.onAuthStateChange(() => {
    actualizarUI();
    cargarCategorias();
    refrescarDatosFiltrados();
});

// Initial Load
actualizarUI();
cargarCategorias();
cargarTransaccionesBD();
actualizarTotalesBD();

// Render Expense Chart (Chart.js)

// Expenses per category: from the view for all months, or summed here for the selected month
async function obtenerGastosPorCategoria() {
    if (!document.getElementById('filtro-mes')?.value) {
        return supabaseClient
            .from('resumen_por_categoria')
            .select('categoria, total_gastado')
            .order('total_gastado', { ascending: false });
    }

    const { data, error } = await filtrarPorMes(supabaseClient
        .from('transacciones')
        .select('monto, categorias(nombre)')
        .eq('tipo', 'Gasto'));
    if (error) return { data: null, error };

    const totales = {};
    // Same as the view: expenses without a category are not shown in the chart
    data.forEach((t) => {
        if (!t.categorias) return;
        const categoria = t.categorias.nombre;
        totales[categoria] = (totales[categoria] || 0) + (parseFloat(t.monto) || 0);
    });

    const resumen = Object.entries(totales)
        .map(([categoria, total_gastado]) => ({ categoria, total_gastado }))
        .sort((a, b) => b.total_gastado - a.total_gastado);
    return { data: resumen, error: null };
}

async function renderizarGraficoGastos() {
    const { data, error } = await obtenerGastosPorCategoria();

    if (error) {
        console.error('Error loading chart data:', error);
        return;
    }

    const labels = data.map(d => d.categoria);
    const valores = data.map(d => Number(d.total_gastado));

    const palette = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];
    const backgroundColors = labels.map((_, i) => palette[i % palette.length]);

    const canvas = document.getElementById('graficogastos');
    if (!canvas) return;

    const chartInstance = Chart.getChart(canvas);
    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: valores,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}