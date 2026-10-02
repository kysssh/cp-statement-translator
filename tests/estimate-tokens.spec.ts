import { describe, expect, it } from 'vitest';
import {
  CHARS_PER_TOKEN,
  estimateOutputTokens,
  estimateRequestCost,
  estimateTokens,
} from '../src/core/estimate-tokens';

describe('estimateTokens', () => {
  it('devuelve 0 para vacío', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('es monótona alargar el texto', () => {
    const corto = estimateTokens('abc');
    const largo = estimateTokens('abc' + 'd'.repeat(400));
    expect(largo).toBeGreaterThan(corto);
  });

  it('usa 4 caracteres por token en inglés por defecto', () => {
    expect(CHARS_PER_TOKEN).toBe(4);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('redondea hacia arriba', () => {
    // 5 caracteres / 4 = 1.25 -> 2
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('abcd')).toBe(1);
  });

  it('acepta un factor propio', () => {
    expect(estimateTokens('a'.repeat(100), 10)).toBe(10);
  });

  it('estima la salida al español con un factor mayor', () => {
    const texto = 'x'.repeat(90);
    expect(estimateOutputTokens(texto)).toBeGreaterThan(estimateTokens(texto));
  });

  it('es puro: dos llamadas dan lo mismo', () => {
    const t = 'The quick brown fox jumps over the lazy dog';
    expect(estimateTokens(t)).toBe(estimateTokens(t));
  });
});

describe('estimateRequestCost', () => {
  it('suma prompt + bloques en entrada y salida', () => {
    const system = 'You are a translator.';
    const blocks = ['Hello world.', 'Goodbye world.'];
    const c = estimateRequestCost(system, blocks);
    expect(c.input).toBe(estimateTokens(system) + estimateTokens('Hello world.') + estimateTokens('Goodbye world.'));
    expect(c.output).toBe(estimateOutputTokens('Hello world.') + estimateOutputTokens('Goodbye world.'));
    expect(c.total).toBe(c.input + c.output);
  });

  it('sin bloques solo cuenta el prompt', () => {
    const system = 'Reglas del glosario.';
    const c = estimateRequestCost(system, []);
    expect(c.output).toBe(0);
    expect(c.input).toBe(estimateTokens(system));
  });

  it('no muta la entrada', () => {
    const blocks = ['a', 'b'];
    const copia = [...blocks];
    estimateRequestCost('p', blocks);
    expect(blocks).toEqual(copia);
  });
});
