import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Mail, User } from 'lucide-react-native'
import { pedirEnlace, pedirUsuario, ultimoUsuario } from '../../api/auth'
import { ProveedorTemaClaro } from '../../tema/claro'
import { MARCA } from '../../tema/tema'
import { Boton, Entrada, Text } from '../../ui'
import { errorEmail, errorUsuario } from '../../util/validaciones'
import FondoLogin, { AvisoAcceso, COLORES, estilos } from './FondoLogin'

// El correo trae un enlace .../restablecer/UID/TOKEN. Si se abre en el celular
// y no lleva a la app, se puede copiar y pegar acá.
function PegarEnlace() {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  function abrir() {
    const m = texto.trim().match(/restablecer\/([^/\s]+)\/([^/\s?#]+)/)
    if (!m) return setError('Pegue el enlace completo que llegó por correo.')
    setError('')
    router.push(`/restablecer/${m[1]}/${m[2]}`)
  }
  return (
    <View style={{ marginTop: 22, borderTopWidth: 1, borderColor: COLORES.linea, paddingTop: 14 }}>
      <Entrada
        etiqueta="¿Ya tiene el enlace del correo? Péguelo acá"
        value={texto}
        onChangeText={setTexto}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://…/restablecer/…"
        error={error}
      />
      <Boton titulo="Abrir enlace" variante="borde" onPress={abrir} disabled={!texto.trim()} />
    </View>
  )
}

// "¿Olvidó su usuario o contraseña?". Para la contraseña, la persona confirma su nombre de usuario y el
// enlace para elegir una contraseña nueva se envía al correo asociado.
// La respuesta es siempre la misma, exista o no.
export default function Olvide() {
  const params = useLocalSearchParams()
  // Qué se quiere recuperar: la contraseña (con el usuario) o el usuario (con el correo)
  const [que, setQue] = useState(params.que === 'usuario' ? 'usuario' : 'contrasena')
  const [nombre, setNombre] = useState(() => params.usuario || ultimoUsuario())
  const [email, setEmail] = useState('')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState('')
  const [enviando, setEnviando] = useState(false)

  const porUsuario = que === 'contrasena'
  const valor = porUsuario ? nombre : email
  const errorCampo = porUsuario ? errorUsuario(nombre) : errorEmail(email)
  const verError = (tocado || valor !== '') && errorCampo

  function elegir(nueva) {
    setQue(nueva)
    setTocado(false)
    setError('')
  }

  async function enviar() {
    setError('')
    setTocado(true)
    if (errorCampo) return
    setEnviando(true)
    try {
      const r = porUsuario ? await pedirEnlace(nombre.trim()) : await pedirUsuario(email.trim().toLowerCase())
      setEnviado(r.mensaje)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ProveedorTemaClaro>
      <FondoLogin
        titulo={enviado ? 'Revise su correo' : porUsuario ? 'Recuperar contraseña' : 'Recuperar usuario'}
        subtitulo={
          enviado
            ? porUsuario
              ? 'El enlace vence en 24 horas y sirve una sola vez.'
              : 'Con ese nombre de usuario y su contraseña puede volver a ingresar.'
            : porUsuario
              ? 'Enviaremos al correo asociado a su usuario un enlace para elegir una contraseña nueva.'
              : 'Escriba el correo de su cuenta y le enviaremos su nombre de usuario.'
        }
      >
        {enviado ? (
          <AvisoAcceso tipo="ok">{enviado}</AvisoAcceso>
        ) : (
          <>
            {/* ¿Qué olvidó? */}
            <View style={propios.elegir} accessibilityRole="radiogroup">
              {[
                ['contrasena', 'Mi contraseña'],
                ['usuario', 'Mi usuario'],
              ].map(([clave, texto]) => (
                <Pressable
                  key={clave}
                  onPress={() => elegir(clave)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: que === clave }}
                  style={[propios.opcion, que === clave && propios.opcionActiva]}
                >
                  <Text style={[propios.opcionTexto, que === clave && propios.opcionTextoActiva]}>{texto}</Text>
                </Pressable>
              ))}
            </View>
            {porUsuario ? (
              <Entrada
                etiqueta="Nombre de usuario *"
                icono={User}
                value={nombre}
                onChangeText={setNombre}
                onBlur={() => setTocado(true)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="send"
                onSubmitEditing={enviar}
                maxLength={254}
                placeholder="apellido + inicial del nombre"
                autoFocus
                error={verError || ''}
                ayuda="Su apellido y la primera letra de su nombre. Ejemplo: Juan Pérez → perezj"
              />
            ) : (
              <Entrada
                etiqueta="Correo electrónico *"
                icono={Mail}
                value={email}
                onChangeText={(t) => setEmail(t.replace(/\s/g, ''))}
                onBlur={() => setTocado(true)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={enviar}
                maxLength={254}
                placeholder="usuario@correo.com"
                error={verError || ''}
                ayuda="El mismo correo con el que le crearon la cuenta."
              />
            )}
            <AvisoAcceso>{error}</AvisoAcceso>
            <Boton
              titulo={enviando ? 'Enviando…' : porUsuario ? 'Enviar enlace' : 'Enviar mi usuario'}
              onPress={enviar}
              cargando={enviando}
              disabled={Boolean(errorCampo)}
              grande
            />
          </>
        )}
        <PegarEnlace />
        <Text style={estilos.enlace} onPress={() => router.replace('/login')} accessibilityRole="link">
          ← Volver a iniciar sesión
        </Text>
      </FondoLogin>
    </ProveedorTemaClaro>
  )
}

// Selector "Mi contraseña / Mi usuario" (los colores son los del login, siempre claro)
const propios = StyleSheet.create({
  elegir: { flexDirection: 'row', gap: 4, padding: 4, marginBottom: 14, backgroundColor: '#F9FAFC', borderWidth: 1, borderColor: COLORES.linea, borderRadius: 14 },
  opcion: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  opcionActiva: { backgroundColor: '#ffffff', elevation: 2, shadowColor: '#15121c', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  opcionTexto: { color: COLORES.gris, fontWeight: '700', fontSize: 15 },
  opcionTextoActiva: { color: MARCA.violeta },
})
