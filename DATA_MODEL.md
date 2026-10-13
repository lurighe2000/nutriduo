# Modelo de datos

Todos los registros pertenecen a un `profileId`. Los IDs son UUID, con fecha de creación/actualización y versión. Índices `[profileId+date]` permiten lecturas por día sin mezclar perfiles.

Perfiles: identidad, nacimiento, sexo metabólico, altura, preferencias, actividad, objetivos confirmados, tema y hash del PIN.

Tablas: profiles, foods, meals (con instantánea de componentes), recipes (con ingredientes), weights, measurements, photos, plans (con días y ejercicios), sessions (con series), checkins, hydration, activity, adjustments, settings.

Los componentes de comidas, ingredientes y series se almacenan dentro de sus agregados para escritura atómica y exportación consistente. Conservar la instantánea nutricional evita que editar un alimento altere comidas históricas. El estado global no contiene los registros de otros perfiles. El backup por perfil utiliza schema versionado, valida relaciones e identidad, excluye credenciales PIN y restaura atómicamente los registros del perfil activo.
