import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('/app/public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Limit: 1 canción por IP por día
const ipLog = new Map(); // ip -> 'YYYY-MM-DD'

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function ipUsada(ip) {
  return ipLog.get(ip) === hoy();
}

function registrarIp(ip) {
  ipLog.set(ip, hoy());
  // Limpiar entradas de días anteriores cada 1000 llamadas
  if (ipLog.size > 1000) {
    const today = hoy();
    for (const [k, v] of ipLog) if (v !== today) ipLog.delete(k);
  }
}

app.post('/api/generar-letra', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (ipUsada(ip)) {
    return res.status(429).json({ limitada: true, error: 'Ya generaste tu canción de hoy. ¡Escríbenos para continuar!' });
  }

  const { nombre, edad, relacion, ocasion, estilo, historia, dedicatoria, tuNombre, edadCumple, edadIncluir, nombreIncluir, emocion, voz, referencia } = req.body;

  const esInfantil = edad && parseInt(edad) <= 12;

  const reglasEspeciales = [
    emocion
      ? `*** La canción debe transmitir una emoción predominante de "${emocion}". Toda la letra, las metáforas y el tono deben reflejar esa emoción. ***`
      : null,
    voz && voz !== 'Sin preferencia'
      ? `*** La canción será cantada por una voz de ${voz}. Adapta el lenguaje, los pronombres y el registro vocal a esa voz. ***`
      : null,
    edadCumple && edadIncluir === 'Sí'
      ? `*** OBLIGATORIO: Esta canción celebra que ${nombre} cumple EXACTAMENTE ${edadCumple} años. Debes mencionar "${edadCumple} años" (o "${edadCumple} primaveras" / "tus ${edadCumple}") de forma natural al menos 2 veces en la canción. ***`
      : edadCumple && edadIncluir === 'No'
      ? `*** NO menciones la edad ${edadCumple} en ninguna parte de la canción. ***`
      : null,
    tuNombre && nombreIncluir === 'Sí'
      ? `*** OBLIGATORIO: Quien dedica esta canción se llama "${tuNombre}". Debes mencionar su nombre al menos una vez de forma natural en la canción (por ejemplo: "de parte de ${tuNombre}", "te canta ${tuNombre}", etc.). ***`
      : tuNombre && nombreIncluir === 'No'
      ? `*** NO menciones el nombre "${tuNombre}" (quien dedica) en ninguna parte de la canción. ***`
      : null,
  ].filter(Boolean).join('\n');

  const prompt = `Eres un experto compositor.
Crea una canción ${esInfantil ? 'infantil ' : ''}para ${nombre}${edad ? ` (${edad})` : ''}${relacion ? `, ${relacion}` : ''} en género ${estilo || 'pop'}${referencia ? `, al estilo de ${referencia}` : ''}.

Donde expreses:
${historia}

Para la siguiente ocasión: ${ocasion || 'ninguna en específico'}

De parte de: ${tuNombre || 'alguien especial'}

${reglasEspeciales ? `REGLAS ESPECIALES (son obligatorias, no las ignores):\n${reglasEspeciales}\n` : ''}
${dedicatoria ? `Dedicatoria (debe aparecer EXACTAMENTE así, sin cambiar ni agregar nada, en el [spoken intro]):\n"${dedicatoria}"\n` : ''}

Estructura de la canción:
${dedicatoria ? `[spoken intro]\n` : ''}[verse]
[chorus]
[verse]
[chorus]
[bridge]
[outro]

Reglas generales:
- 6 líneas cada sección excepto el [spoken intro]
- Incluye el nombre "${nombre}" al menos 4 veces en la canción
- Sé coherente, no uses metáforas raras
${dedicatoria ? `- El [spoken intro] debe contener ÚNICAMENTE la dedicatoria "${dedicatoria}" tal cual, sin cambiar ni agregar nada` : '- No uses [spoken intro]'}
- Revisa que hayas cumplido TODAS las reglas especiales antes de entregar`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    });

    registrarIp(ip);
    res.json({ letra: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando la letra' });
  }
});

app.post('/api/webhook-cancion', async (req, res) => {
  try {
    const response = await fetch('https://n8n-n8n.zfmsog.easypanel.host/webhook-test/9ee5b657-2baf-4a2a-9419-d5c28279ab3a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Error enviando webhook' });
  }
});

app.listen(3001, () => console.log('API lista en puerto 3001'));
