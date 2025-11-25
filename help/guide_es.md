# Guía de Usuario - IntelHub 🕵️

Bienvenido a IntelHub. Esta extensión agrupa herramientas avanzadas de inteligencia de fuentes abiertas (OSINT) en una interfaz única y cómoda, permitiendo a investigadores y analistas realizar operaciones de manera rápida y eficiente.

---

## 🏠 Visión General - Interfaz Principal
En la parte superior izquierda de la extensión, encontrarás el botón **Refresh** para actualizar la lista de herramientas y la configuración.
Debajo hay una **Barra de Búsqueda** (Search Bar) para localizar rápidamente categorías o herramientas específicas.

![Menú Principal - Superior](images/1.png)

A la derecha, hay una **Barra de Desplazamiento** para navegar entre las diferentes categorías. En la esquina superior derecha, hay un botón para cambiar el **Tema Visual** (Theme).

![Menú Principal - Desplazamiento](images/2.png)

---

## ⭐ Favorites - Gestión de Favoritos
Esta categoría centraliza las herramientas que has marcado como "Favoritas" del grupo general, y permite agregar herramientas personalizadas y gestionar categorías.

![Pantalla de Favoritos](images/3.png)

### Acciones Principales:
**New Category:** Crea nuevas carpetas/categorías para organizar tus herramientas favoritas.

![Crear Nueva Categoría](images/4.png)

**Add Custom Tool:** Agrega una herramienta externa (que no está en la extensión) introduciendo un Nombre, URL y una breve descripción. Puedes asignar la herramienta a una categoría específica antes de guardar.

![Agregar Herramienta Personalizada](images/5.png)

**Export/Import:** Exporta tu lista de favoritos y configuraciones como un archivo de respaldo, o impórtalos para transferirlos a otro usuario.

![Exportar e Importar](images/6.png)

**Gestión Continua:**
Así es como se ve la lista de herramientas después de agregar elementos.
Para eliminar una categoría, haz clic en el icono de la papelera a la derecha. Para eliminar una herramienta de favoritos, haz clic en el icono de la Estrella (Unstar).

![Lista de Favoritos](images/7.png)

---

## 🛠️ OSINT Tools - Repositorio de Herramientas
Esta categoría contiene el núcleo de la extensión: una lista completa de herramientas de inteligencia divididas por temas. La lista se sincroniza automáticamente con el repositorio de GitHub y se actualiza cada 24 horas (o mediante una actualización manual).

Al hacer clic en un tema (Categoría) se abrirá la lista de herramientas pertenecientes a él:

![Categorías y Herramientas](images/8.png)

* Al hacer clic en una herramienta, se abrirá en una nueva pestaña.
* Al hacer clic en el icono de la Estrella junto al nombre, se añadirá a "Favoritos".
* Al pasar el cursor sobre una herramienta, se mostrará una breve descripción (Tooltip) de su función.

![Descripción de Herramienta](images/9.png)

---

## 🖼️ Reverse Image Search - Búsqueda Inversa de Imágenes
Esta herramienta permite realizar una búsqueda inversa de imágenes en múltiples motores de búsqueda simultáneamente.

![Menú de Búsqueda Inversa](images/10.png)

**Opciones de Entrada:**
1.  **Upload:** Subir un archivo de imagen desde tu computadora.
2.  **Paste:** Pegar una imagen directamente desde el Portapapeles.

*Antes de buscar, selecciona las casillas de los motores de búsqueda que deseas utilizar (Google, Yandex, Bing, TinEye, etc.). Tu selección se guarda para la próxima vez.*

---

## 📄 Metadata Analyzer - Análisis de Metadatos
Una herramienta para extraer información oculta (Metadatos/EXIF) de archivos.

![Seleccionar Tipo de Archivo](images/11.png)

Selecciona el tipo de archivo deseado (Imagen, PDF o documento de Office) y súbelo. El informe de datos aparecerá inmediatamente en la parte inferior de la ventana (desplázate hacia abajo para ver todos los detalles).

![Resultados de Metadatos](images/12.png)

---

## 🔍 Google Dorks - Constructor de Consultas
Una interfaz para construir fácilmente consultas de búsqueda avanzadas en Google.

![Constructor de Dorks](images/13.png)

Introduce los parámetros deseados en los distintos campos (Búsqueda dentro de un sitio específico, Tipo de archivo, Palabras clave en Título/URL/Texto).
Después de construir la consulta, puedes hacer clic en **Search on Google** para una ejecución inmediata, o ver la estructura de la consulta en el cuadro de abajo y copiarla.

![Copiar Consulta](images/14.png)

---

## ✈️ Telegram Tools - Herramientas de Telegram
Un conjunto de herramientas para investigaciones en Telegram. Esta categoría permite búsquedas de números de teléfono, recopilación de detalles de usuarios/grupos y análisis de exportaciones.

![Menú de Herramientas Telegram](images/15.png)

**User & Group Profiler:** Introduce un nombre de usuario (o enlace) para realizar un escaneo profundo y mostrar detalles del usuario, foto de perfil, estado y una opción para obtener el ID Numérico (**Fetch Numeric ID**).

![Resultados del Perfilador de Telegram](images/16.png)

---

## 🌐 Site, Link & Archive - Análisis de Sitios
Una colección de herramientas para analizar la página actual o una URL específica para un reconocimiento inicial.

![Menú de Análisis de Sitio](images/17.png)

**Herramientas Disponibles:**
1.  **Website Fingerprint:** Captura la huella digital del sitio (tecnologías, cookies) para verificaciones de autenticidad.
2.  **WHOIS & DNS:** Verifica la propiedad del dominio y los registros DNS.
3.  **Technology Detection:** Identifica la pila tecnológica subyacente.
4.  **Subdomain Finder:** Localiza subdominios.
5.  **Save Page Offline:** Guarda la página actual como un archivo HTML local para documentación.
6.  **Archive Search:** Busca el historial del sitio en varios archivos web.

---

## 🆔 Social ID Extractor
Diseñado para extraer el **ID Numérico de Usuario** de perfiles de redes sociales, o para navegar a un perfil basado en un ID existente.

![Menú de Extracción de ID](images/18.png)

Navega a la página de perfil (por ejemplo, en Facebook) y haz clic en el primer botón para extraer el ID.

![Resultado de Extracción](images/19.png)

---

## 🔗 Link Analyzer - Análisis de Enlaces
Contiene herramientas para verificar la seguridad y el origen de los enlaces.

![Menú de Análisis de Enlaces](images/20.png)

* **Unshorten URL:** Decodifica enlaces acortados (como bit.ly) para revelar la dirección original.
* **Scan for Viruses:** Verifica el enlace contra la base de datos de VirusTotal.

---

## 📝 Text Profiler - Perfilador de Texto
Escanea y extrae **Entidades** del texto. El sistema identifica correos electrónicos, billeteras de criptomonedas, números de teléfono, nombres de usuario y más.

![Menú de Perfilador de Texto](images/21.png)

Puedes analizar texto mediante **Paste** (Pegar), carga de archivo de texto externo, o escaneando la **Página Actual** en el navegador. Los resultados se pueden exportar a CSV.

---

## 📊 Investigation Graph - Gráfico de Investigación
Al hacer clic en esta categoría se abre el sistema de visualización.

![Botón de Gráfico](images/22.png)

Usando el gráfico, puedes crear un mapa de investigación, agregar tarjetas de entidades y vincularlas para visualizar claramente el panorama de inteligencia.

![Interfaz del Gráfico](images/23.png)
