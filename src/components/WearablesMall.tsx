import React, { useState } from 'react';
import { Product, Order, OrderStatus, LogisticsTracking } from '../types';
import { PRODUCTS_DATA } from '../data';
import { 
  ShoppingCart, Truck, Compass, CheckCircle2, AlertCircle, ShoppingBag, 
  MapPin, Phone, User, CreditCard, ChevronRight, X, Clock, HelpCircle
} from 'lucide-react';

interface WearablesMallProps {
  orders: Order[];
  onPlaceOrder: (order: Order) => void;
  onUpdateOrderStatus: (updatedOrder: Order) => void;
}

export default function WearablesMall({ orders, onPlaceOrder, onUpdateOrderStatus }: WearablesMallProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Form states
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'form' | 'qr' | 'success'>('form');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openCheckout = (product: Product) => {
    setSelectedProduct(product);
    setIsCheckoutOpen(true);
    setPaymentStep('form');
    setErrorMessage(null);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage('请完整填写收货人、联系电话及详细收件地址！');
      return;
    }
    setErrorMessage(null);
    // Advance to QR code payment screen
    setPaymentStep('qr');
  };

  const handleConfirmMockPayment = () => {
    if (!selectedProduct) return;
    setIsPaying(true);
    
    setTimeout(() => {
      setIsPaying(false);
      setPaymentStep('success');

      // Create simulated initial tracking log
      const initialLogs: LogisticsTracking[] = [
        {
          time: new Date().toISOString().replace('T', ' ').slice(0, 19),
          content: '【森心康康复基地科技仓】：宝贝已经成功支付并打包就绪，正等待仓储小哥交接配车抢运中。',
          location: '森心康科技基地总部'
        }
      ];

      const newOrder: Order = {
        id: 'ORD_' + Math.floor(100000 + Math.random() * 900000),
        product: selectedProduct,
        quantity: 1,
        totalPrice: selectedProduct.price,
        recipient,
        phone,
        address,
        status: 'paid', // starts as paid as checkout finished
        paymentMethod,
        createdAt: new Date().toISOString(),
        trackingNo: 'SF' + Math.floor(100000000 + Math.random() * 900000000),
        logisticsTimeline: initialLogs
      };

      onPlaceOrder(newOrder);
      // Auto register to view this order details
      setSelectedOrder(newOrder);
    }, 2000);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setSelectedProduct(null);
    setPaymentStep('form');
    setErrorMessage(null);
  };

  // Helper: Interactive sandbox simulation to "speed run logistics and check status"
  const handleAdvanceLogistics = (order: Order) => {
    // Current timeline index transition
    let nextStatus: OrderStatus = 'paid';
    let content = '';
    let location = '';

    const currentLogs = [...order.logisticsTimeline];

    if (order.status === 'delivered') {
      return;
    }

    if (currentLogs.length === 1) {
      nextStatus = 'shipped';
      content = '【大连医用快件分拨营业点】：快件已经由快递小哥接手揽件并发出。承运商：国家航线生鲜温保急速速递。';
      location = '呼兰分部营地';
    } else if (currentLogs.length === 2) {
      nextStatus = 'shipped'; 
      content = '【国际生物冷链中心】：快件已成功到达本市中心调配分拨机场，专职生鲜冷链运输航班正在配货派车。';
      location = '中心枢纽调度站';
    } else if (currentLogs.length === 3) {
      nextStatus = 'delivering';
      content = '【当地少年康复园区接手站】：宝贝已进入您的配送路程段，专配小苏师傅（139-4455-8899）正在进行加温密闭包装运输配送。请保持手机电源畅通！';
      location = '本地末端快配站';
    } else {
      nextStatus = 'delivered';
      content = '【尊贵家庭门口】：森心康高精密康复传感器已安全交付！感谢您选择森心康儿童数字干预，祝宝贝神经突触突飞猛进！';
      location = order.address;
    }

    const newLog: LogisticsTracking = {
      time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      content,
      location
    };

    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
      logisticsTimeline: [...order.logisticsTimeline, newLog]
    };

    onUpdateOrderStatus(updatedOrder);
    setSelectedOrder(updatedOrder);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Mall Navbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 py-4.5 rounded-3xl border border-brand-stone shadow-sm gap-4">
        <div className="text-left">
          <h2 className="text-lg font-bold font-sans text-brand-forest flex items-center gap-1.5">
            <ShoppingBag className="text-brand-moss" size={20} />
            森心康发展评估商城
          </h2>
          <p className="text-xs text-brand-charcoal/80 mt-1">专业级脑机反馈系统、精细抓握阻尼手套、三维步态追踪成长护具，感觉动作发展极速到家</p>
        </div>
        <div className="flex bg-brand-cream/40 p-1.5 rounded-2xl border border-brand-stone/50 shrink-0">
          <button
            id="mall-tab-products"
            onClick={() => setActiveTab('products')}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'products'
                ? 'bg-white text-brand-moss border border-brand-stone/40 shadow-sm font-extrabold'
                : 'text-brand-charcoal/80 hover:text-brand-forest'
            }`}
          >
            <ShoppingCart size={13} />
            设备展示与订购
          </button>
          <button
            id="mall-tab-orders"
            onClick={() => {
              setActiveTab('orders');
              if (orders.length > 0 && !selectedOrder) {
                // Default to last order
                setSelectedOrder(orders[orders.length - 1]);
              }
            }}
            className={`px-4.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 relative ${
              activeTab === 'orders'
                ? 'bg-white text-brand-moss border border-brand-stone/40 shadow-sm font-extrabold'
                : 'text-brand-charcoal/80 hover:text-brand-forest'
            }`}
          >
            <Truck size={13} />
            物流与订单进度
            {orders.length > 0 && (
              <span className="absolute top-[-2px] right-[-2px] w-4.5 h-4.5 bg-rose-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-sans">
                {orders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'products' ? (
        /* Products list page */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {PRODUCTS_DATA.map((product) => (
            <div key={product.id} className="bg-white rounded-3xl border border-brand-stone p-5 flex flex-col justify-between hover:border-brand-moss transition-all hover:shadow-md overflow-hidden relative group">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="w-full sm:w-44 h-44 bg-brand-cream/20 rounded-2xl overflow-hidden relative shrink-0 border border-brand-stone/30">
                  <img
                    src={product.image}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                  />
                  <span className="absolute top-2.5 left-2.5 bg-brand-forest/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-sm">
                    森心康原装
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="text-base font-extrabold text-brand-forest">{product.name}</h3>
                    <p className="text-[11px] text-brand-charcoal/80 leading-relaxed mt-1.5">
                      {product.desc}
                    </p>
                  </div>
                  
                  {/* Prices label */}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-xl font-sans font-extrabold text-brand-moss">¥{product.price}</span>
                    <span className="text-xs font-sans text-brand-charcoal/50 line-through">¥{product.originalPrice}</span>
                  </div>
                </div>
              </div>

              {/* Product specifications specifications, perks, and direct buy buttons */}
              <div className="mt-5 pt-4.5 border-t border-brand-cream flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {product.dimensionsTargeted.map((dimKey) => (
                    <span key={dimKey} className="text-[9px] font-bold bg-brand-sand/65 text-brand-clay px-2.5 py-0.5 rounded-full border border-brand-stone/50">
                      OT协作: {dimKey === 'attention' ? '注意力' : dimKey === 'sensory' ? '感觉统合' : dimKey === 'fine_motor' ? '精细动作' : dimKey === 'gross_motor' ? '粗大动作' : '情绪'}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2.5 shrink-0">
                  <button
                    id={`view-detail-btn-${product.id}`}
                    onClick={() => openCheckout(product)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-brand-cream/30 hover:bg-brand-cream text-brand-charcoal text-xs font-bold rounded-xl border border-brand-stone transition"
                  >
                    详情与购买
                  </button>
                  <button
                    id={`instant-buy-btn-${product.id}`}
                    onClick={() => openCheckout(product)}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-forest/10 transition active:scale-[0.98]"
                  >
                    立即订购
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Orders page with Logistics Timelines */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          {/* Orders sidebar panel (Left list) */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-xs font-bold text-brand-charcoal/60 tracking-wider font-semibold">我的商城订单 ({orders.length})</h3>
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-brand-stone p-8 text-center text-brand-charcoal space-y-3">
                <ShoppingBag className="mx-auto text-brand-charcoal/40" size={32} />
                <p className="text-xs">您当前尚未下单购买任何评估或康复辅助设备</p>
                <button
                  onClick={() => setActiveTab('products')}
                  className="px-4 py-2 bg-brand-sage text-brand-forest rounded-xl text-xs font-bold border border-brand-moss/30 hover:bg-brand-cream transition inline-block"
                >
                  去商城看一眼
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <button
                    id={`order-item-btn-${ord.id}`}
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`w-full p-4 rounded-2xl border text-left bg-white transition hover:border-brand-moss ${
                      selectedOrder?.id === ord.id ? 'border-brand-moss bg-brand-sage/10 ring-2 ring-brand-moss/8' : 'border-brand-stone'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-brand-charcoal/60">
                      <span>单号: {ord.id}</span>
                      <span className={`font-bold ${
                        ord.status === 'delivered' ? 'text-brand-charcoal/70' :
                        ord.status === 'delivering' ? 'text-brand-clay' : 'text-brand-moss'
                      }`}>
                        {ord.status === 'paid' ? '已支付「待发货」' :
                         ord.status === 'shipped' ? '已安排「运输中」' :
                         ord.status === 'delivering' ? '专业派送中' : '已顺利签收'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-brand-forest mt-2 truncate">{ord.product.name}</h4>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-sans font-extrabold text-brand-forest">¥{ord.totalPrice}</span>
                      <span className="text-[10px] text-brand-charcoal/60 font-sans">{ord.logisticsTimeline.length} 条物流更新记录</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logistics tracking details panel (Right detailed tracking) */}
          <div className="lg:col-span-8">
            {selectedOrder ? (
              <div className="bg-white rounded-3xl border border-brand-stone p-5 md:p-7 shadow-sm space-y-6">
                
                {/* Logistics status summary ribbon */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-cream pb-5">
                  <div>
                    <div className="text-[10px] text-brand-charcoal/50">数字康复物流跟踪</div>
                    <h3 className="text-base font-bold text-brand-forest mt-0.5">订单号: {selectedOrder.id}</h3>
                    <p className="text-[11px] text-brand-charcoal/70 mt-1">快递单号: {selectedOrder.trackingNo} (顺丰特快急包)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      id="logistics-speed-sim-btn"
                      disabled={selectedOrder.status === 'delivered'}
                      onClick={() => handleAdvanceLogistics(selectedOrder)}
                      className={`px-4 py-2 text-xs font-extrabold rounded-xl border transition flex items-center gap-1.5 shrink-0 ${
                        selectedOrder.status === 'delivered'
                          ? 'bg-brand-sage text-brand-forest/65 border-brand-moss/20 cursor-not-allowed opacity-80'
                          : 'bg-brand-sand/65 hover:bg-brand-sand text-brand-clay border border-brand-stone/60'
                      }`}
                    >
                      <Compass size={13} />
                      {selectedOrder.status === 'delivered' ? '宝贝包裹已送达签收' : '一键加速模拟物流物理推进'}
                    </button>
                  </div>
                </div>

                {/* Sub-components showing actual shipping path */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-brand-forest tracking-wide uppercase">动态快件物流详情追踪 (最新往上)</h4>

                  <div className="relative pl-5 border-l-2 border-brand-stone/60 space-y-6 pt-2 pb-2">
                    {[...selectedOrder.logisticsTimeline].reverse().map((log, lidx) => {
                      const isLatest = lidx === 0;
                      return (
                        <div key={lidx} className="relative text-left">
                          {/* Circle dot marker */}
                          <span className={`absolute left-[-26px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${
                            isLatest ? 'bg-brand-moss ring-brand-sage' : 'bg-brand-stone ring-brand-cream bg-brand-stone/50'
                          }`} />

                          <div className="space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 justify-between">
                              <span className={`text-xs font-bold ${isLatest ? 'text-brand-moss' : 'text-brand-charcoal/80'}`}>
                                {log.location}
                              </span>
                              <span className="text-[10px] text-brand-charcoal/50 font-mono font-medium">{log.time}</span>
                            </div>
                            <p className={`text-xs leading-relaxed ${isLatest ? 'text-brand-forest font-bold' : 'text-brand-charcoal/70'}`}>
                              {log.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shipping target address credentials */}
                <div className="p-4 bg-brand-cream/35 rounded-2xl border border-brand-stone flex flex-col sm:flex-row justify-between gap-4 text-xs text-brand-charcoal">
                  <div className="space-y-1.5">
                    <div className="font-bold text-brand-forest">收货地址专签：</div>
                    <div className="flex items-center gap-1.5 text-brand-charcoal">
                      <MapPin size={13} className="text-brand-charcoal/45 shrink-0" />
                      <span>{selectedOrder.address}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:text-right shrink-0">
                    <div className="font-bold text-brand-forest">收货人：</div>
                    <div className="flex items-center sm:justify-end gap-1.5 text-brand-charcoal">
                      <User size={13} className="text-brand-charcoal/45 shrink-0" />
                      <span>{selectedOrder.recipient} ({selectedOrder.phone})</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-brand-stone p-12 text-center text-brand-charcoal space-y-4">
                <HelpCircle className="mx-auto text-brand-charcoal/40" size={40} />
                <h3 className="text-sm font-bold text-brand-forest">请选择一个硬件订单以浏览它的详细物流状态</h3>
                <p className="text-xs max-w-sm mx-auto">
                  每次购买将生成一个专属物流快件。您可以通过右上方控制盘，仿真包裹空运、陆挽派送路线的全链路推进体验。
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Dialog Modal */}
      {isCheckoutOpen && selectedProduct && (
        <div className="fixed inset-0 bg-brand-forest/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-brand-stone max-w-xl w-full p-6 md:p-8 shadow-2xl relative overflow-hidden text-left max-h-[90vh] overflow-y-auto">
            
            {/* Close button */}
            <button
              id="close-checkout-modal-btn"
              onClick={closeCheckout}
              className="absolute right-4 top-4 p-2 text-brand-charcoal hover:text-brand-forest hover:bg-brand-cream rounded-full transition"
            >
              <X size={18} />
            </button>

            {paymentStep === 'form' ? (
              /* Step 1: Input shipping info */
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-forest">确认产品信息并填写寄送详情</h3>
                  <p className="text-xs text-brand-charcoal/60 mt-1">森心康智能精准评估康复硬件，极低延迟OT训练包</p>
                </div>

                {/* Selected item card brief */}
                <div className="flex gap-4 p-4.5 bg-brand-cream/35 border border-brand-stone rounded-2xl">
                  <div className="w-16 h-16 rounded-xl bg-white overflow-hidden shrink-0 border border-brand-stone/50">
                    <img src={selectedProduct.image} alt={selectedProduct.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-forest">{selectedProduct.name}</h4>
                    <span className="text-xs font-sans text-brand-charcoal/70 block mt-1">{selectedProduct.desc.slice(0, 42)}...</span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-sm font-sans font-extrabold text-brand-moss">¥{selectedProduct.price}</span>
                      <span className="text-[10px] text-brand-charcoal/50 font-sans line-through">¥{selectedProduct.originalPrice}</span>
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200/60 text-rose-700 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Info input fields */}
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-brand-charcoal flex items-center gap-1">
                        <User size={12} className="text-brand-charcoal/60" /> 收件人姓名
                      </label>
                      <input
                        id="ship-recipient-input"
                        type="text"
                        required
                        placeholder="例如: 张医生"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-brand-cream/15 border border-brand-stone rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-moss focus:border-brand-moss text-brand-charcoal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-brand-charcoal flex items-center gap-1">
                        <Phone size={12} className="text-brand-charcoal/60" /> 收件人手机联系电话
                      </label>
                      <input
                        id="ship-phone-input"
                        type="tel"
                        required
                        placeholder="例如: 13912345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-brand-cream/15 border border-brand-stone rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-moss focus:border-brand-moss text-brand-charcoal"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-charcoal flex items-center gap-1">
                      <MapPin size={12} className="text-brand-charcoal/60" /> 详细投递物理地址
                    </label>
                    <input
                      id="ship-address-input"
                      type="text"
                      required
                      placeholder="例如: 北京市海淀区森心康儿童数字干预示范点3楼302室"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-brand-cream/15 border border-brand-stone rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-moss focus:border-brand-moss text-brand-charcoal block"
                    />
                  </div>

                  {/* Payment selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-brand-charcoal">支付网关渠道</label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        id="pay-method-wechat-btn"
                        type="button"
                        onClick={() => setPaymentMethod('wechat')}
                        className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                          paymentMethod === 'wechat'
                            ? 'border-brand-moss bg-brand-sage/40 text-brand-forest font-bold'
                            : 'border-brand-stone bg-brand-cream/20 text-brand-charcoal/60'
                        }`}
                      >
                        <CreditCard size={14} className="text-brand-moss" />
                        微信专属在线闪付
                      </button>
                      <button
                        id="pay-method-alipay-btn"
                        type="button"
                        onClick={() => setPaymentMethod('alipay')}
                        className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${
                          paymentMethod === 'alipay'
                            ? 'border-brand-clay bg-brand-sand/40 text-brand-clay font-bold'
                            : 'border-brand-stone bg-brand-cream/20 text-brand-charcoal/60'
                        }`}
                      >
                        <CreditCard size={14} className="text-brand-clay" />
                        支付宝极速闪付
                      </button>
                    </div>
                  </div>

                  <button
                    id="confirm-checkout-btn"
                    type="submit"
                    className="w-full py-3.5 bg-brand-moss hover:bg-brand-moss/90 text-white font-bold rounded-xl text-xs shadow-md transition shadow-brand-forest/10 active:scale-[0.98] mt-2 block"
                  >
                    确认提货并调取在线扫码支付
                  </button>
                </form>
              </div>
            ) : paymentStep === 'qr' ? (
              /* Step 2: Show simulation payment QR */
              <div className="text-center space-y-6 py-4">
                <div>
                  <h3 className="text-lg font-bold text-brand-forest">
                    森心康 {paymentMethod === 'wechat' ? '微信' : '支付宝'} 在线扫码闪付模拟
                  </h3>
                  <p className="text-xs text-brand-charcoal/60 mt-1">使用手机模拟相机对准扫码支付，或直接点击下方模拟确认</p>
                </div>

                {/* simulated QR image */}
                <div className="w-48 h-48 bg-brand-cream/25 border border-brand-stone rounded-2xl mx-auto flex items-center justify-center p-3 relative shadow-inner">
                  <div className="w-full h-full bg-white rounded-xl flex flex-col justify-center items-center text-brand-charcoal p-2 border-2 border-dashed border-brand-stone/60">
                    <span className="text-3xl">📱</span>
                    <span className="text-xs font-bold text-brand-forest mt-2">
                      {paymentMethod === 'wechat' ? 'WECHAT PAY' : 'ALIPAY'}
                    </span>
                    <span className="text-[9px] text-brand-charcoal/60 mt-1 uppercase">Scan QR simulation code</span>
                    <span className="text-xs font-extrabold text-brand-forest mt-2 font-mono">¥{selectedProduct.price}</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-center max-w-sm mx-auto">
                  <button
                    id="mock-cancel-pay-btn"
                    onClick={() => setPaymentStep('form')}
                    className="flex-1 py-2.5 border border-brand-stone bg-brand-cream/35 text-brand-charcoal/80 rounded-xl text-xs font-semibold transition hover:bg-brand-cream"
                  >
                    修改收件地址
                  </button>
                  <button
                    id="mock-confirm-pay-btn"
                    disabled={isPaying}
                    onClick={handleConfirmMockPayment}
                    className="flex-1 py-2.5 bg-brand-moss hover:bg-brand-moss/90 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-brand-forest/20"
                  >
                    {isPaying ? (
                      <span className="flex items-center gap-1.5">
                        <Clock size={12} className="animate-spin" />
                        正在划款授权...
                      </span>
                    ) : (
                      <span>模拟确认支付成功</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Step 3: Payment Success */
              <div className="text-center space-y-5 py-6">
                <div className="w-16 h-16 bg-brand-sage text-brand-forest rounded-full flex items-center justify-center mx-auto shadow-md scale-105 border border-brand-moss/30">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-brand-forest">🎉 商品交易成功，恭喜顺府！</h3>
                  <p className="text-xs text-brand-charcoal/80">
                    您的订单 【{selectedProduct.name}】 已经在系统挂急包极速发库！
                  </p>
                </div>
                <div className="bg-brand-cream/35 p-4 rounded-xl text-left text-[11px] text-brand-charcoal max-w-md mx-auto space-y-1.5 border border-brand-stone">
                  <div><span className="font-bold text-brand-forest">收货地址：</span>{address}</div>
                  <div><span className="font-bold text-brand-forest">预留人：</span>{recipient} (手机: {phone})</div>
                  <div><span className="font-bold text-brand-forest">配仓承运商：</span>顺丰儿童冷藏温控安全护航特快服务</div>
                </div>

                <button
                  id="checkout-all-finish-btn"
                  onClick={() => {
                    closeCheckout();
                    setActiveTab('orders'); // Jump directly to logistics view
                  }}
                  className="px-6 py-2.5 bg-brand-forest hover:bg-brand-forest/90 text-white font-bold rounded-xl text-xs transition shadow-md shadow-brand-forest/30"
                >
                  去查看物流订单追踪
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
