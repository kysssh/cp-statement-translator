/**
 * Glosario y prompt del sistema para documentación técnica (T39).
 *
 * Política decidida:
 * - Los nombres técnicos de algoritmos y estructuras de datos se dejan en inglés
 *   (segment tree, BFS, Dijkstra, etc.): en la literatura de CP esos son los
 *   nombres que los lectores buscarán en Google y en el código.
 * - Los términos pedagógicos y de programación general sí se traducen, igual
 *   que en el prompt de enunciados.
 * - Nombres de personas, algoritmos epónimos y problemas nunca se traducen.
 * - Registro didáctico, más natural que el de un enunciado formal.
 */

/** Versión semántica del glosario: al cambiarla, la caché por bloque (T38) se invalida. */
export const DOC_GLOSSARY_VERSION = '2';

/**
 * Glosario como dato estructurado, para poder versionarlo (T38) y auditarlo.
 * Formato: { término_inglés: traducción_español }
 * Los términos con valor vacío ('') se copian sin traducir (son opacos para el modelo).
 */
export const DOC_GLOSSARY: Record<string, string> = {
  // Estructura y navegación
  'table of contents': 'índice de contenidos',
  'introduction': 'introducción',
  'overview': 'visión general',
  'summary': 'resumen',
  'example': 'ejemplo',
  'exercise': 'ejercicio',
  'problem': 'problema',
  'solution': 'solución',
  'approach': 'enfoque',
  'implementation': 'implementación',
  'complexity': 'complejidad',
  'time complexity': 'complejidad temporal',
  'space complexity': 'complejidad espacial',
  'proof': 'demostración',
  'claim': 'afirmación',
  'observation': 'observación',
  'lemma': 'lema',
  'theorem': 'teorema',
  'corollary': 'corolario',

  // Programación general (igual que enunciados, para consistencia)
  'array': 'arreglo',
  'string': 'cadena',
  'integer': 'entero',
  'boolean': 'booleano',
  'pointer': 'puntero',
  'index': 'índice',
  'loop': 'ciclo',
  'function': 'función',
  'variable': 'variable',
  'input': 'entrada',
  'output': 'salida',
  'print': 'imprimir',
  'read': 'leer',

  // Estructuras de datos — se dejan en inglés (son los nombres canónicos en CP)
  'segment tree': '',   // opaco: no traducir
  'binary indexed tree': '',
  'Fenwick tree': '',
  'sparse table': '',
  'suffix array': '',
  'suffix automaton': '',
  'trie': '',
  'treap': '',
  'splay tree': '',
  'skip list': '',
  'union-find': '',
  'disjoint set union': '',
  'priority queue': '',
  'deque': '',
  'stack': '',
  'queue': '',
  'heap': '',
  'hash map': '',
  'hash set': '',

  // Algoritmos — se dejan en inglés
  'BFS': '',
  'DFS': '',
  'Dijkstra': '',
  'Bellman-Ford': '',
  'Floyd-Warshall': '',
  'Kruskal': '',
  'Prim': '',
  'Tarjan': '',
  'Kosaraju': '',
  'KMP': '',
  'Z-function': '',
  'Z-algorithm': '',

  // Conceptos de CP que sí se pueden traducir
  'greedy': 'voraz (greedy)',
  'divide and conquer': 'divide y vencerás',
  'dynamic programming': 'programación dinámica',
  'memoization': 'memoización',
  'backtracking': 'backtracking',   // opaco: conocido en español así
  'brute force': 'fuerza bruta',
  'binary search': 'búsqueda binaria',
  'two pointers': 'dos punteros',
  'sliding window': 'ventana deslizante',
  'prefix sum': 'suma de prefijos',
  'difference array': 'arreglo de diferencias',
  'permutation': 'permutación',
  'combination': 'combinación',
  'bitmasking': 'enmascaramiento de bits',
  'modular arithmetic': 'aritmética modular',
  'greatest common divisor': 'máximo común divisor',
  'least common multiple': 'mínimo común múltiplo',
  'binary exponentiation': 'exponenciación binaria',
  'number theory': 'teoría de números',
  'modular inverse': 'inverso modular',
  'prime factorization': 'factorización prima',
  'range query': 'consulta de rango',
  'point update': 'actualización puntual',
  'lazy propagation': 'propagación diferida (lazy propagation)',

  // Graph theory
  'graph': 'grafo',
  'tree': 'árbol',
  'node': 'nodo',
  'vertex': 'vértice',
  'edge': 'arista',
  'path': 'camino',
  'cycle': 'ciclo',
  'connected component': 'componente conexa',
  'strongly connected component': 'componente fuertemente conexa',
  'topological sort': 'orden topológico',
  'spanning tree': 'árbol de expansión',
  'shortest path': 'camino más corto',
  'weighted graph': 'grafo ponderado',
  'directed graph': 'grafo dirigido',
  'undirected graph': 'grafo no dirigido',
};

/** Glosario serializado para incluir en el prompt (solo pares con traducción no vacía). */
function glossaryText(): string {
  return Object.entries(DOC_GLOSSARY)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `  ${k} → ${v}`)
    .join('\n');
}

/**
 * Prompt del sistema para documentación explicativa (tutoriales, artículos).
 * Distinto del de enunciados: registro más natural, conserva términos técnicos.
 */
export const DOC_SYSTEM_PROMPT = `Eres un traductor técnico especializado en documentación de programación competitiva (USACO Guide, CP-Algorithms).
Traduces artículos didácticos del inglés al español neutro (latinoamericano).

REGLAS ABSOLUTAS
1. Los tokens ⟦n⟧ y ⟦/n⟧ son marcadores de fórmulas, código o formato. Cópialos EXACTAMENTE: mismo número, mismo orden, misma cantidad. No los traduzcas, renumeres ni muevas.
2. No añadas ni quites contenido. No expliques conceptos adicionales.
3. LaTeX ($...$, $$...$$, \\(...\\), \\[...\\]) y los identificadores de código se copian tal cual.
4. Nombres de personas (Dijkstra, Kruskal, Tarjan…), nombres de algoritmos epónimos y nombres de problemas NO se traducen.
5. Registro didáctico: más natural que un enunciado formal. Usa "podemos ver que", "note que", etc.
6. Los siguientes términos técnicos se dejan en inglés (son los nombres canónicos que los lectores buscarán):
   segment tree, BFS, DFS, trie, treap, Fenwick tree, sparse table, suffix array, suffix automaton, union-find, disjoint set union.

GLOSARIO (aplica con consistencia)
${glossaryText()}

FORMATO DE SALIDA
Recibes JSON {"blocks": [cadenas]}. Devuelves ÚNICAMENTE JSON {"blocks": [cadenas]} con el mismo número de elementos en el mismo orden. Sin markdown, sin backticks, sin texto adicional.`;

export const DOC_STRICT_REMINDER =
  '\nATENCIÓN: en un intento anterior se perdieron o cambiaron marcadores ⟦n⟧. Verifica que cada marcador aparece exactamente igual en tu traducción.';
