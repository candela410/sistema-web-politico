"""Backend de correo para desarrollo: muestra cada correo en la terminal de
runserver, legible. La consola de Django lo imprime codificado como viaja por
internet (quoted-printable): los acentos salen como =C3=AD y los enlaces largos
se cortan en dos líneas, así que no se pueden copiar."""

from django.core.mail.backends import console


class ConsolaLegible(console.EmailBackend):
    def write_message(self, message):
        self.stream.write(
            "\n"
            + "=" * 79
            + f"\nDe:     {message.from_email}"
            + f"\nPara:   {', '.join(message.to)}"
            + f"\nAsunto: {message.subject}\n"
            + "-" * 79
            + f"\n{message.body}\n"
            + "=" * 79
            + "\n"
        )
