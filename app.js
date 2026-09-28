import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://eqkkrcjdzdlhzwdnunoh.supabase.co'
const supabaseKey = 'sb_publishable_0pfomhywrBLPzaDVJ927HQ_TGTqRNfD'

export const supabase = createClient(supabaseUrl, supabaseKey)
// --- AUTENTICACIÓN ---
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const btnSignup = document.getElementById('btn-signup')
const btnLogin = document.getElementById('btn-login')
const btnLogout = document.getElementById('btn-logout')
const authStatus = document.getElementById('auth-status')

btnSignup.addEventListener('click', async () => {
  const { data, error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value
  })
  authStatus.textContent = error ? error.message : 'Registrado. Revisa tu email si hace falta confirmarlo.'
})

btnLogin.addEventListener('click', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  })
  authStatus.textContent = error ? error.message : 'Sesión iniciada'
  if (!error) actualizarUI()
})

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut()
  actualizarUI()
})

function actualizarUI() {
  supabase.auth.getSession().then(({ data }) => {
    const logueado = !!data.session
    btnLogout.style.display = logueado ? 'inline' : 'none'
    btnLogin.style.display = logueado ? 'none' : 'inline'
    btnSignup.style.display = logueado ? 'none' : 'inline'
  })
}

actualizarUI()
let idEditando = null
const form = document.getElementById('form-transaccion')

form.addEventListener('submit', async (e) => {
  e.preventDefault()

  const { data: { user } } = await supabase.auth.getUser()

  const datosTransaccion = {
  user_id: user.id,
  monto: document.getElementById('monto').value,
  tipo: document.getElementById('tipo').value,
  categoria_id: document.getElementById('categoria').value || null,
  descripcion: document.getElementById('descripcion').value,
  fecha: document.getElementById('fecha').value || undefined
}

  let error

  if (idEditando) {
    const resultado = await supabase
      .from('transacciones')
      .update(datosTransaccion)
      .eq('id', idEditando)
    error = resultado.error
  } else {
    const resultado = await supabase
      .from('transacciones')
      .insert(datosTransaccion)
    error = resultado.error
  }

  if (error) {
    console.error('Error al guardar:', error)
  } else {
    form.reset()
    idEditando = null
    cargarTransacciones()
  }
})


// ==========================================
// 1. FUNCIÓN PARA MOSTRAR LA LISTA
// ==========================================
async function cargarTransacciones() {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*, categorias(nombre)')
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error al cargar transacciones:', error)
    return
  }

  const lista = document.getElementById('lista-transacciones')
  if (!lista) return
  lista.innerHTML = ''

  data.forEach(t => {
    const li = document.createElement('li')
    const nombreCategoria = t.categorias ? ` [${t.categorias.nombre}]` : ''
    
    li.textContent = `${t.fecha} — ${t.tipo}: ${t.monto}€ (${t.descripcion || 'sin descripción'})${nombreCategoria} `

    const btnEditar = document.createElement('button')
    btnEditar.textContent = 'Editar'
    btnEditar.onclick = () => cargarEnFormulario(t)

    const btnBorrar = document.createElement('button')
    btnBorrar.textContent = 'Borrar'
    btnBorrar.onclick = () => borrarTransaccion(t.id)

    li.appendChild(btnEditar)
    li.appendChild(btnBorrar)
    lista.appendChild(li)
  })

  // Al terminar de pintar la lista, llamamos al cálculo del resumen
  calcularResumen()
} // <--- AQUÍ SE CIERRA LA FUNCIÓN cargarTransacciones
// ==========================================
function cargarEnFormulario(t) {
  idEditando = t.id

  document.getElementById('monto').value = t.monto
  document.getElementById('tipo').value = t.tipo
  document.getElementById('categoria').value = t.categoria_id || ''
  document.getElementById('descripcion').value = t.descripcion || ''
  document.getElementById('fecha').value = t.fecha || ''

  document.querySelector('#form-transaccion button[type="submit"]').textContent = 'Actualizar'
}



// ==========================================
// 2. FUNCIÓN PARA MOSTRAR EL RESUMEN
// ==========================================
async function calcularResumen() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data, error } = await supabase
    .rpc('obtener_resumen_usuario', { p_user_id: user.id })

  if (error) {
    console.error('Error al calcular resumen con RPC:', error)
    return
  }

  if (data && data.length > 0) {
    const resumen = data[0]
    document.getElementById('total-ingresos').textContent = Number(resumen.total_ingresos || 0).toFixed(2)
    document.getElementById('total-gastos').textContent = Number(resumen.total_gastos || 0).toFixed(2)
    document.getElementById('saldo-total').textContent = Number(resumen.saldo_total || 0).toFixed(2)
  }
}


async function borrarTransaccion(id) {
  const { error } = await supabase
    .from('transacciones')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error al borrar:', error)
  } else {
    cargarTransacciones()
  }
}

cargarTransacciones()

const formCategoria = document.getElementById('form-categoria')

formCategoria.addEventListener('submit', async (e) => {
  e.preventDefault()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('categorias')
    .insert({
      user_id: user.id,
      nombre: document.getElementById('nombre-categoria').value
    })

  if (error) {
    console.error('Error al crear categoría:', error)
  } else {
    formCategoria.reset()
    cargarCategorias()
  }
})

async function cargarCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre')

  if (error) {
    console.error('Error al cargar categorías:', error)
    return
  }

  const lista = document.getElementById('lista-categorias')
  lista.innerHTML = ''

  const selectCategoria = document.getElementById('categoria')
  selectCategoria.innerHTML = '<option value="">Sin categoría</option>'

  data.forEach(c => {
    const li = document.createElement('li')
    li.textContent = c.nombre
    lista.appendChild(li)

    const option = document.createElement('option')
    option.value = c.id
    option.textContent = c.nombre
    selectCategoria.appendChild(option)
  })
}

cargarCategorias()

// --- FUNCIONES DE BASE DE DATOS Y SQL ---

// Insertar una transacción en Supabase
export async function agregarTransaccionBD(concepto, monto, tipo) {
  const { data, error } = await supabase
    .from('transacciones')
    .insert([
      { concepto: concepto, monto: parseFloat(monto), tipo: tipo }
    ]);

  if (error) {
    console.error('Error insertando registro:', error);
  } else {
    console.log('Registro guardado con éxito:', data);
    cargarTransaccionesBD();
  }
}

// Consultar todas las transacciones (SELECT)
export async function cargarTransaccionesBD() {
  const { data, error } = await supabase
    .from('transacciones')
    .select('*')
    .order('fecha', { ascending: false });

  if (error) {
    console.error('Error cargando registros:', error);
    return;
  }

  console.log('Transacciones traídas desde Supabase:', data);
}