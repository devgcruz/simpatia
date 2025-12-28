import { useState, useEffect } from 'react';

/**
 * Hook customizado para debounce de valores
 * Retorna o valor apenas após o delay especificado desde a última mudança
 * 
 * @param value - Valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 500ms)
 * @returns Valor debounced
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 600);
 * 
 * // O input atualiza instantaneamente
 * <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
 * 
 * // Mas a busca só acontece após 600ms sem digitação
 * useEffect(() => {
 *   fetchData(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Configurar timer para atualizar o valor debounced após o delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpar timer se o valor mudar antes do delay expirar
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

