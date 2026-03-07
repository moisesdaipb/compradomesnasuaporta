import React, { useState } from 'react';
import { ViewState, SaleItem, PaymentMethod, Customer } from '../types';
import { validateCPF } from '../utils';

interface DeliveryInfo {
    address: string;
    number: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    complement?: string;
    contact: string;
    notes?: string;
}

interface CustomerCheckoutViewProps {
    cart: SaleItem[];
    customer: Customer | null;
    onCreateSale: (
        customerId: string,
        customerName: string,
        items: SaleItem[],
        paymentMethod: PaymentMethod,
        channel: 'online' | 'presencial',
        installmentsCount?: number,
        installmentDates?: number[],
        deliveryInfo?: {
            address: string;
            number: string;
            neighborhood?: string;
            city?: string;
            zipCode?: string;
            state?: string;
            complement?: string;
            contact: string;
            notes?: string;
        },
        paymentSubMethod?: string,
        changeAmount?: number,
    ) => Promise<any>;
    onUpdateProfile: (updates: Partial<Customer>) => Promise<void>;
    onClearCart: () => void;
    setView: (v: ViewState) => void;
}

const CustomerCheckoutView: React.FC<CustomerCheckoutViewProps> = ({
    cart,
    customer,
    onCreateSale,
    onUpdateProfile,
    onClearCart,
    setView,
}) => {
    // Modificado: Apenas CPF e Telefone são obrigatórios para considerar perfil "completo" para checkout
    // O endereço será preenchido na etapa 'delivery' se necessário.
    const isProfileComplete = !!(customer?.cpf && customer?.phone);

    // Se o perfil não estiver completo, força step 'profile-completion'
    // Se estiver completo, vai para 'delivery' por padrão
    const [step, setStep] = useState<'delivery' | 'payment' | 'profile-completion' | 'processing' | 'success'>(
        !isProfileComplete ? 'profile-completion' : 'delivery'
    );
    const [processingContext, setProcessingContext] = useState<'profile' | 'sale'>('sale');
    const [paymentMethod] = useState<PaymentMethod>(PaymentMethod.ON_DELIVERY); // Padronizado para entrega
    const [isDeliveryMethodSelected, setIsDeliveryMethodSelected] = useState(false);
    const [deliverySubMethod, setDeliverySubMethod] = useState<'Dinheiro' | 'Cartão' | 'PIX' | null>(null);
    const [needsChange, setNeedsChange] = useState(false);
    const [changeAmount, setChangeAmount] = useState('');

    // Address Selection State
    const hasSavedAddress = !!(customer?.address && customer?.addressNumber);
    const hasPartialAddress = !!(customer?.address || customer?.addressNumber || customer?.neighborhood || customer?.city) && !hasSavedAddress;
    const [addressOption, setAddressOption] = useState<'saved' | 'new'>(hasSavedAddress ? 'saved' : 'new');
    const [isSearching, setIsSearching] = useState(false);

    // Delivery form
    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
        address: customer?.address || '',
        number: customer?.addressNumber || '',
        neighborhood: customer?.neighborhood || '',
        city: customer?.city || '',
        state: customer?.state || '',
        zipCode: customer?.zipCode || '',
        complement: customer?.complement || '',
        contact: customer?.phone || customer?.name || '',
        notes: '',
    });

    // Handle address selection change
    React.useEffect(() => {
        if (addressOption === 'saved' && customer) {
            setDeliveryInfo({
                address: customer.address || '',
                number: customer.addressNumber || '',
                neighborhood: customer.neighborhood || '',
                city: customer.city || '',
                state: customer.state || '',
                zipCode: customer.zipCode || '',
                complement: customer.complement || '',
                contact: customer.phone || customer.name || '',
                notes: '',
            });
        }
    }, [addressOption, customer]);



    // BrasilAPI CEP Lookup logic
    React.useEffect(() => {
        const cleanCEP = deliveryInfo.zipCode?.replace(/\D/g, '');
        if (cleanCEP?.length === 8 && addressOption === 'new') {
            const fetchCEP = async () => {
                setIsSearching(true);
                try {
                    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);
                    if (!response.ok) throw new Error('CEP não encontrado');
                    const data = await response.json();
                    setDeliveryInfo(prev => ({
                        ...prev,
                        address: data.street || prev.address,
                        neighborhood: data.neighborhood || prev.neighborhood,
                        city: data.city || prev.city,
                        state: data.state || prev.state,
                        zipCode: data.cep || prev.zipCode,
                    }));
                } catch (error) {
                    console.error('CEP lookup error:', error);
                } finally {
                    setIsSearching(false);
                }
            };
            fetchCEP();
        }
    }, [deliveryInfo.zipCode, addressOption]);


    const total = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
    const itemCount = cart.reduce((acc, i) => acc + i.quantity, 0);

    const isDeliveryValid = deliveryInfo.address && deliveryInfo.number && deliveryInfo.contact;

    // Profile form (for progressive onboarding)
    const [profileData, setProfileData] = useState({
        cpf: customer?.cpf || '',
        phone: customer?.phone || '',
    });

    const isProfileValid = !!(profileData.cpf && validateCPF(profileData.cpf)) && !!(profileData.phone && profileData.phone.length >= 14);

    const normalizeString = (str: string) => str.trim().replace(/\s+/g, ' ');

    const [showSafetyButton, setShowSafetyButton] = React.useState(false);

    React.useEffect(() => {
        let timer: any;
        if (step === 'processing') {
            timer = setTimeout(() => setShowSafetyButton(true), 15000);
        } else {
            setShowSafetyButton(false);
        }
        return () => clearTimeout(timer);
    }, [step]);

    const handleConfirm = async () => {
        if (!customer) {
            console.error('[Checkout] No customer found');
            return;
        }

        const startFull = Date.now();
        console.log(`[Checkout] [${new Date().toISOString()}] handleConfirm started. Current step: ${step}`);

        // 1. If profile is NOT complete and we are NOT on the completion screen, go there.
        if (!isProfileComplete && step !== 'profile-completion') {
            console.log('[Checkout] Profile incomplete, moving to profile-completion');
            setStep('profile-completion');
            return;
        }

        // 2. If we ARE on profile completion, handle the update
        if (step === 'profile-completion') {
            if (!validateCPF(profileData.cpf)) {
                alert('O CPF informado é inválido. Por favor, revise seus dados.');
                return;
            }

            setProcessingContext('profile');
            setStep('processing'); // Enter processing ONLY during the actual request
            console.log(`[Checkout] [${Date.now() - startFull}ms] Updating profile...`);

            try {
                await onUpdateProfile({
                    cpf: normalizeString(profileData.cpf),
                    phone: normalizeString(profileData.phone),
                    address: normalizeString(deliveryInfo.address),
                    addressNumber: normalizeString(deliveryInfo.number),
                    neighborhood: normalizeString(deliveryInfo.neighborhood || ''),
                    city: normalizeString(deliveryInfo.city || ''),
                    state: normalizeString(deliveryInfo.state || ''),
                    zipCode: normalizeString(deliveryInfo.zipCode || ''),
                    complement: normalizeString(deliveryInfo.complement || ''),
                    // Persist address data to customer record immediately
                    last_delivery_contact: normalizeString(deliveryInfo.contact),
                });
                console.log(`[Checkout] [${Date.now() - startFull}ms] Profile updated successfully.`);

                // CRUCIAL: Change view BEFORE the alert to avoid blocking UI re-render
                setView('customer-cart');
                alert('Perfil atualizado com sucesso! Agora você pode finalizar seu pedido.');
                return;
            } catch (err: any) {
                console.error(`[Checkout] [${Date.now() - startFull}ms] Profile update failed:`, err);
                const errorMessage = err?.message || 'Erro ao atualizar seu perfil. Por favor, verifique os dados.';
                alert(errorMessage);
                setStep('profile-completion'); // Go back to try again
                return;
            }
        }

        // 3. Final Sale Creation Step (from Payment/Final screen)
        console.log('[Checkout] Finalizing sale creation...');
        setProcessingContext('sale');
        setStep('processing');

        try {
            console.log(`[Checkout] [${Date.now() - startFull}ms] Calling onCreateSale...`);
            const saleStart = Date.now();

            const saleResult = await onCreateSale(
                customer.id,
                customer.name,
                cart,
                paymentMethod,
                'online',
                undefined,
                undefined,
                {
                    ...deliveryInfo,
                    address: normalizeString(addressOption === 'saved' ? customer.address || deliveryInfo.address : deliveryInfo.address),
                    number: normalizeString(addressOption === 'saved' ? customer.addressNumber || deliveryInfo.number : deliveryInfo.number),
                    neighborhood: normalizeString(deliveryInfo.neighborhood || ''),
                    city: normalizeString(deliveryInfo.city || ''),
                    contact: normalizeString(deliveryInfo.contact),
                    notes: `FORMA: ${deliverySubMethod}${deliverySubMethod === 'Dinheiro' ? (needsChange ? ` (Troco para R$ ${changeAmount})` : ' (Sem troco)') : ''}${deliveryInfo.notes ? ` | REF: ${normalizeString(deliveryInfo.notes)}` : ''}`
                },
                deliverySubMethod || undefined,
                needsChange ? parseFloat(changeAmount) : undefined,
            );

            console.log(`[Checkout] [${Date.now() - startFull}ms] onCreateSale finished. Duration: ${Date.now() - saleStart}ms. Result:`, saleResult);

            onClearCart();
            setStep('success');
            console.log(`[Checkout] [${Date.now() - startFull}ms] handleConfirm completed successfully.`);
        } catch (error: any) {
            console.error(`[Checkout] [${Date.now() - startFull}ms] Failed to create sale:`, error);
            const msg = error?.message || 'Houve um erro ao processar seu pedido. Por favor, tente novamente ou fale conosco.';
            alert(msg);
            setStep('payment');
        }
    };

    // Success Screen
    if (step === 'success') {
        return (
            <div className="flex flex-col h-full items-center justify-center px-8 text-center animate-in fade-in duration-500">
                <div className="size-24 bg-success/10 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                    <span className="material-symbols-outlined text-5xl text-success">check_circle</span>
                </div>
                <h2 className="text-2xl font-black mb-2">Pedido Confirmado!</h2>
                <p className="text-slate-500 mb-2">
                    {paymentMethod === PaymentMethod.ON_DELIVERY
                        ? 'Você pagará na entrega. Aguarde nosso entregador!'
                        : 'Seu pedido será entregue em breve.'}
                </p>
                <p className="text-sm text-slate-400 mb-8">
                    Acompanhe o status em "Meus Pedidos".
                </p>
                <button
                    onClick={() => setView('customer-orders')}
                    className="px-8 py-4 bg-primary text-white font-bold rounded-xl mb-3"
                >
                    Ver Meus Pedidos
                </button>
                <button
                    onClick={() => setView('customer-store')}
                    className="text-primary font-medium"
                >
                    Continuar Comprando
                </button>
            </div>
        );
    }

    // Processing Screen
    if (step === 'processing') {
        return (
            <div className="flex flex-col h-full items-center justify-center px-8 text-center bg-white dark:bg-slate-900">
                <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                    {processingContext === 'profile' ? 'Atualizando seu cadastro...' : 'Processando...'}
                </h2>
                <p className="text-slate-500 mb-8">
                    {processingContext === 'profile'
                        ? 'Aguarde enquanto salvamos suas informações no servidor.'
                        : 'Aguarde enquanto confirmamos seu pedido no servidor.'}
                </p>

                {showSafetyButton && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <p className="text-sm text-danger font-bold mb-4">Está demorando mais que o esperado...</p>
                        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                            <button
                                onClick={() => setStep(processingContext === 'profile' ? 'profile-completion' : 'payment')}
                                className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl"
                            >
                                Voltar e Tentar Novamente
                            </button>
                            {processingContext === 'sale' && (
                                <>
                                    <button
                                        onClick={() => {
                                            onClearCart();
                                            setView('customer-orders');
                                        }}
                                        className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg"
                                    >
                                        Verificar "Meus Pedidos"
                                    </button>
                                    <p className="text-xs text-slate-400 mt-4">
                                        Seu pedido pode ter sido salvo. Verifique no histórico antes de tentar pagar novamente.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => step === 'delivery' ? setView('customer-cart') : setStep('delivery')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h3 className="text-lg font-bold">
                        {step === 'delivery' ? 'Endereço de Entrega' : step === 'payment' ? 'Pagamento' : 'Completar Perfil'}
                    </h3>
                </div>
            </div>

            {/* Progress */}
            <div className="px-4 mt-2">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <div className="h-1 rounded-full bg-primary" />
                        <p className="text-[10px] text-slate-400 mt-1 text-center">Carrinho</p>
                    </div>
                    <div className="flex-1">
                        <div className={`h-1 rounded-full ${['delivery', 'payment', 'profile-completion'].includes(step) ? 'bg-primary' : 'bg-slate-200'}`} />
                        <p className="text-[10px] text-slate-400 mt-1 text-center">Entrega</p>
                    </div>
                    <div className="flex-1">
                        <div className={`h-1 rounded-full ${['payment', 'profile-completion'].includes(step) ? 'bg-primary' : 'bg-slate-200'}`} />
                        <p className="text-[10px] text-slate-400 mt-1 text-center">Pagamento</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 pb-52 overflow-y-auto space-y-4">
                {step === 'delivery' && (
                    <>
                        {/* Address Choice */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-primary">local_shipping</span>
                                <span className="font-bold text-sm">Informações de Entrega</span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {hasSavedAddress && customer && (
                                    <button
                                        onClick={() => setAddressOption('saved')}
                                        className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all text-left ${addressOption === 'saved' ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-700'}`}
                                    >
                                        <div className={`mt-0.5 size-10 rounded-xl flex items-center justify-center ${addressOption === 'saved' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <span className="material-symbols-outlined">home</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">Meu endereço cadastrado</p>
                                            <p className="text-xs text-slate-500 line-clamp-1">{customer.address}, {customer.addressNumber}</p>
                                            <p className="text-[10px] text-slate-400">{customer.neighborhood}, {customer.city}</p>
                                        </div>
                                        {addressOption === 'saved' && <span className="material-symbols-outlined text-primary">check_circle</span>}
                                    </button>
                                )}

                                {/* Warning when user has partial address but it's incomplete */}
                                {!hasSavedAddress && hasPartialAddress && (
                                    <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50 flex items-start gap-3">
                                        <div className="mt-0.5 size-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600 shrink-0">
                                            <span className="material-symbols-outlined">warning</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-amber-800">Endereço incompleto</p>
                                            <p className="text-xs text-amber-600 mt-0.5">Seu perfil possui um endereço parcial. Preencha os campos abaixo para continuar.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Message for users with no address at all */}
                                {!hasSavedAddress && !hasPartialAddress && (
                                    <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50 flex items-start gap-3">
                                        <div className="mt-0.5 size-10 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600 shrink-0">
                                            <span className="material-symbols-outlined">info</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm text-blue-800">Informe seu endereço</p>
                                            <p className="text-xs text-blue-600 mt-0.5">Preencha o endereço de entrega abaixo. Ele ficará salvo para suas próximas compras.</p>
                                        </div>
                                    </div>
                                )}

                                {hasSavedAddress && (
                                    <button
                                        onClick={() => setAddressOption('new')}
                                        className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all text-left ${addressOption === 'new' ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-700'}`}
                                    >
                                        <div className={`mt-0.5 size-10 rounded-xl flex items-center justify-center ${addressOption === 'new' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <span className="material-symbols-outlined">add_location</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">Entregar em outro endereço</p>
                                            <p className="text-xs text-slate-500">Informar um novo local para esta entrega</p>
                                        </div>
                                        {addressOption === 'new' && <span className="material-symbols-outlined text-primary">check_circle</span>}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Delivery Address Form (show when new address OR no saved address) */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            {(addressOption === 'new' || !hasSavedAddress) && (
                                <div className="space-y-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="relative">
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">CEP</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.zipCode}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                                    const formatted = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val;
                                                    setDeliveryInfo({ ...deliveryInfo, zipCode: formatted });
                                                }}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold"
                                                placeholder="00000-000"
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3 top-[34px]">
                                                    <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Número *</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.number}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, number: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold"
                                                placeholder="123"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Rua *</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.address}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                                placeholder="Rua, Avenida..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Bairro *</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.neighborhood}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, neighborhood: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Cidade *</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.city}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, city: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">UF *</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.state}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, state: e.target.value.toUpperCase().slice(0, 2) })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                                placeholder="SP"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Complemento</label>
                                            <input
                                                type="text"
                                                value={deliveryInfo.complement}
                                                onChange={(e) => setDeliveryInfo({ ...deliveryInfo, complement: e.target.value })}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                                placeholder="Apto, Bloco..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Quem recebe? *</label>
                                    <input
                                        type="text"
                                        value={deliveryInfo.contact}
                                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, contact: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                        placeholder="Nome do destinatário"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Ponto de Referência</label>
                                    <input
                                        type="text"
                                        value={deliveryInfo.notes}
                                        onChange={(e) => setDeliveryInfo({ ...deliveryInfo, notes: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium"
                                        placeholder="Ex: Perto do mercado"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-primary">shopping_bag</span>
                                <span className="font-bold text-sm">Resumo</span>
                            </div>
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.basketModelId} className="flex justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-300">{item.quantity}x {item.basketName}</span>
                                        <span className="font-bold">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-700 font-black">
                                    <span>Total</span>
                                    <span className="text-primary">R$ {total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {step === 'payment' && (
                    <div className="space-y-4">
                        {/* Delivery Confirmation */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2t">
                                <span className="material-symbols-outlined text-primary">location_on</span>
                                <span className="font-bold text-sm">Entregar em:</span>
                            </div>
                            <p className="text-sm mt-2">{deliveryInfo.address}, {deliveryInfo.number}</p>
                            <p className="text-xs text-slate-500">Falar com: {deliveryInfo.contact}</p>
                            {deliveryInfo.notes && (
                                <p className="text-xs text-slate-400 mt-1">Ref: {deliveryInfo.notes}</p>
                            )}
                            <button
                                onClick={() => setStep('delivery')}
                                className="text-xs text-primary font-medium mt-2"
                            >
                                Alterar endereço
                            </button>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="space-y-4">
                            {!isDeliveryMethodSelected ? (
                                <button
                                    onClick={() => setIsDeliveryMethodSelected(true)}
                                    className="w-full p-6 rounded-3xl border-2 border-primary bg-primary/5 flex items-center gap-6 transition-all hover:bg-primary/10 group animate-in zoom-in-95 duration-300 shadow-sm"
                                >
                                    <div className="size-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-3xl">local_shipping</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Pagamento na Entrega</h4>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pague ao receber seu pedido</p>
                                    </div>
                                    <span className="material-symbols-outlined text-primary">arrow_forward_ios</span>
                                </button>
                            ) : (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary font-bold">payments</span>
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 dark:text-white">Forma de Pagamento</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha como pagar ao entregador</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsDeliveryMethodSelected(false);
                                                setDeliverySubMethod(null);
                                            }}
                                            className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                        >
                                            Alterar
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'Dinheiro', icon: 'payments', label: 'Dinheiro' },
                                                { id: 'Cartão', icon: 'credit_card', label: 'Cartão' },
                                                { id: 'PIX', icon: 'qr_code_2', label: 'PIX' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setDeliverySubMethod(opt.id as any)}
                                                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${deliverySubMethod === opt.id
                                                        ? 'border-primary bg-primary/5 text-primary shadow-inner'
                                                        : 'border-slate-50 dark:border-slate-700 text-slate-300 hover:text-slate-500 hover:border-slate-200'
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {deliverySubMethod === 'Dinheiro' && (
                                            <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-5 animate-in fade-in zoom-in-95 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">filter_1</span>
                                                        <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Precisa de troco?</span>
                                                    </div>
                                                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
                                                        <button
                                                            onClick={() => setNeedsChange(false)}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${!needsChange ? 'bg-primary text-white shadow-md' : 'text-slate-400'}`}
                                                        >
                                                            NÃO
                                                        </button>
                                                        <button
                                                            onClick={() => setNeedsChange(true)}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${needsChange ? 'bg-primary text-white shadow-md' : 'text-slate-400'}`}
                                                        >
                                                            SIM
                                                        </button>
                                                    </div>
                                                </div>

                                                {needsChange && (
                                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                                        <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Troco para quanto?</label>
                                                        <div className="relative">
                                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                                <span className="text-sm font-black text-slate-400">R$</span>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={changeAmount}
                                                                onChange={(e) => setChangeAmount(e.target.value.replace(/\D/g, ''))}
                                                                className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-white dark:bg-slate-800 text-sm font-black text-slate-900 dark:text-white transition-all outline-none"
                                                                placeholder="Ex: 50, 100"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Total */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-slate-500">Subtotal ({itemCount} itens)</span>
                                <span className="font-medium">R$ {total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mb-2">
                                <span className="text-slate-500">Entrega</span>
                                <span className="text-success font-medium">Grátis</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                                <span className="font-bold">Total</span>
                                <span className="text-xl font-black text-primary">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'profile-completion' && (
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4">
                        <div className="text-center mb-6">
                            <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-3xl text-primary">person_edit</span>
                            </div>
                            <h3 className="text-xl font-bold">Quase lá!</h3>
                            <p className="text-sm text-slate-500">Precisamos de alguns dados para a nota fiscal.</p>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                CPF *
                            </label>
                            <input
                                type="text"
                                value={profileData.cpf}
                                onChange={(e) => {
                                    const numbers = e.target.value.replace(/\D/g, '');
                                    const formatted = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
                                    setProfileData({ ...profileData, cpf: formatted });
                                }}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                                placeholder="000.000.000-00"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Telefone *
                            </label>
                            <input
                                type="text"
                                value={profileData.phone}
                                onChange={(e) => {
                                    const numbers = e.target.value.replace(/\D/g, '');
                                    const formatted = numbers.length <= 10
                                        ? numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
                                        : numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').slice(0, 15);
                                    setProfileData({ ...profileData, phone: formatted });
                                }}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <div className="pt-2">
                            <p className="text-[10px] text-slate-400">
                                Ao confirmar, utilizaremos o endereço de entrega acima como seu endereço padrão.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                {step === 'delivery' ? (
                    <button
                        onClick={() => setStep('payment')}
                        disabled={!isDeliveryValid}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${isDeliveryValid
                            ? 'bg-primary text-white shadow-lg active:scale-[0.98]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        Continuar para Pagamento
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                ) : step === 'profile-completion' ? (
                    <button
                        onClick={handleConfirm}
                        disabled={!isProfileValid}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${isProfileValid
                            ? 'bg-success text-white shadow-lg active:scale-[0.98]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        Salvar Perfil e Voltar ao Carrinho
                    </button>
                ) : (
                    <button
                        onClick={handleConfirm}
                        disabled={!isDeliveryMethodSelected || !deliverySubMethod || (deliverySubMethod === 'Dinheiro' && needsChange && !changeAmount)}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${(!isDeliveryMethodSelected || !deliverySubMethod || (deliverySubMethod === 'Dinheiro' && needsChange && !changeAmount))
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-success text-white active:scale-[0.98]'}`}
                    >
                        <span className="material-symbols-outlined">lock</span>
                        {paymentMethod === PaymentMethod.ON_DELIVERY
                            ? 'Confirmar Pedido'
                            : `Pagar R$ ${total.toFixed(2)}`}
                    </button>
                )}
            </div>
        </div >
    );
};

export default CustomerCheckoutView;
