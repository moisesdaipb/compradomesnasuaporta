export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0
    }).format(value);
};

export const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
        return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};



export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length === 0) return true; // Allows empty if not required by schema
    if (cleanCPF.length !== 11) return false;

    // Check for known invalid CPFs (all digits identical)
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let sum = 0;
    let rev;

    // Validate first digit
    for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    // Validate second digit
    for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
};

/**
 * Converte uma string de data do banco (YYYY-MM-DD) para um timestamp
 * tratando-a como data local para evitar deslocamentos de fuso horário.
 */
export const parseDBDate = (dateStr: string): number => {
    if (!dateStr) return Date.now();
    // Se já for um timestamp ou ISO com tempo, usa o construtor padrão
    if (dateStr.includes('T') || !isNaN(Number(dateStr))) {
        return new Date(dateStr).getTime();
    }
    
    // Para strings "YYYY-MM-DD", quebramos as partes para evitar o shift do fuso UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    // month - 1 porque no JS os meses vão de 0 a 11
    return new Date(year, month - 1, day).getTime();
};
