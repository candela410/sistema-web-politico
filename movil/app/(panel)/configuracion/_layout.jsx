import { Stack } from 'expo-router'
import { useTema } from '../../../src/tema/tema'

export default function Pila() {
  const { c } = useTema()
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
}
