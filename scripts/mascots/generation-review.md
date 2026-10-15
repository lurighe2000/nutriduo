# Revisión de reconstrucción — 15/10/2026

Toda prueba usó únicamente la referencia elegida por Luca, SHA256
`0add4a29ef9c512343b447d30b45519caa12067f5ee399125f441b3874c8c575`.
No se contrataron planes ni se habilitaron inferencia paga, GPU paga o facturación.
Los resultados descartados permanecen fuera del repositorio y del sitio público.

| Servicio                                                                        | Resultado observado                                                                                                          | Decisión                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1), geometría | Volumen real sin textura, oreja caída y proporciones imprecisas                                                              | Estudio neutral ya existente; no personaje terminado       |
| Hunyuan3D-2.1 completo                                                          | Duración GPU fuera del cupo disponible                                                                                       | No pagar ni forzar la duración                             |
| [Hunyuan3D-2](https://huggingface.co/spaces/tencent/Hunyuan3D-2)                | `NameError`, incluso autenticado                                                                                             | No repetir el servicio sin un cambio externo               |
| [Microsoft TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2)        | Generación autenticada; vistas del resultado muestran un panel plano                                                         | Descartado por geometría; no gastar cupo reexportándolo    |
| [Stability TripoSR](https://huggingface.co/spaces/stabilityai/TripoSR)          | Demo en `RUNTIME_ERROR`                                                                                                      | No se generó un archivo                                    |
| [TRELLIS clásico](https://huggingface.co/spaces/trellis-community/TRELLIS)      | GLB descargado, 9.219 vértices / 12.630 triángulos / 1.454.516 bytes; perfil como relieve fino y cara repetida en la espalda | Descartado para articulación; no distribuir como personaje |

El SHA256 del GLB clásico descartado es
`20619545654ce9209a3ce0a9911eb82c28875c3f0d5233ae89de81484c0836b3`.
La revisión incluyó frente, tres cuartos, perfil y espalda en Blender.
No tiene esqueleto, animaciones ni morphs. El conteo de polígonos y la textura
no acreditan anatomía, topología útil ni permiso para distribuir al personaje.

## Clave temporal cerrada

La clave autorizada `NutriDuo-modelos3D-temporal` se creó con todas las casillas
de permisos desmarcadas: sin repositorios privados, escritura, administración,
proveedores de inferencia ni facturación. Nunca se guardó en el repositorio.

Tras terminar las generaciones, la interfaz de borrado no completó el diálogo
del navegador. Se usó entonces el [endpoint oficial de revocación de Hugging
Face](https://huggingface.co/docs/hub/security-tokens#revoking-a-leaked-token)
para invalidar exclusivamente esa clave. Resultado: HTTP 202; comprobación
posterior de autenticación: HTTP 401. La lista oficial confirmó `Invalidated`.
Se eliminó el archivo temporal que contenía el valor secreto.

Evidencia local, sin la clave:
`C:/Users/lucar/.codex/tools/mascot-3d/temporary-token-revocation.json` y
`C:/Users/lucar/.codex/tools/mascot-3d/hf-token-revoked.png`.

## Estudio manual local

`author_angel_study.py` construye geometría nueva en Blender a partir del análisis
de la misma imagen. No importa otra malla de personaje, no hace llamadas de red
y no requiere claves. Incluye materiales, esqueleto, parpadeo y ocho ensayos de
movimiento: idle, saludo, mirada, señalar, celebración, tristeza, baile y pose
de referencia. No se afirma que reproduzcan movimientos cinematográficos.

Persisten diferencias de parecido y problemas de deformación en hombros,
manos y rodillas. Es un archivo de trabajo, **no una sustitución aprobada de
Angel ni un activo listo para publicar**. La piel, la expresión de la sonrisa,
la forma de los ojos y las transiciones requieren revisión adicional.

La imagen única no permite conocer con certeza las superficies ocultas.
No prometer identidad del 99,9% ni calidad de animación de la película.
