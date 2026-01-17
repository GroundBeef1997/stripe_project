import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StripeService } from '../services/stripe.service';
import { StripeCardElement } from '@stripe/stripe-js';

interface Product {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  default_price: {
    id: string;
    unit_amount: number;
    currency: string;
  } | null;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, OnDestroy {
  @ViewChild('cardElement') cardElementRef!: ElementRef;
  cardElement: StripeCardElement | null = null;
  
  products: Product[] = [];
  selectedProduct: Product | null = null;
  loading = false;
  loadingProducts = true;
  errorMessage = '';
  successMessage = '';
  showCheckoutModal = false;
  cardMounted = false;

  constructor(
    private stripeService: StripeService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.fetchAllProducts();
  }

  async fetchAllProducts() {
    this.loadingProducts = true;
    try {
      const response = await this.http.get<Product[]>('http://localhost:3000/api/products').toPromise();
      this.products = response || [];
    } catch (error: any) {
      console.error('Error fetching products:', error);
      this.errorMessage = 'Failed to load products. Make sure the backend server is running.';
    } finally {
      this.loadingProducts = false;
    }
  }

  async openCheckout(product: Product) {
    this.selectedProduct = product;
    this.showCheckoutModal = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    // Wait for modal to render, then mount card element
    setTimeout(async () => {
      await this.initializeStripeCard();
    }, 100);
  }

  async initializeStripeCard() {
    if (this.cardMounted && this.cardElement) {
      return;
    }
    
    try {
      this.cardElement = await this.stripeService.createCardElement();
      if (this.cardElement && this.cardElementRef) {
        this.cardElement.mount(this.cardElementRef.nativeElement);
        this.cardMounted = true;
        this.cardElement.on('change', (event) => {
          if (event.error) {
            this.errorMessage = event.error.message;
          } else {
            this.errorMessage = '';
          }
        });
      }
    } catch (error: any) {
      this.errorMessage = 'Failed to initialize payment form.';
      console.error('Stripe initialization error:', error);
    }
  }

  closeCheckout() {
    this.showCheckoutModal = false;
    this.selectedProduct = null;
    this.errorMessage = '';
    this.successMessage = '';
    if (this.cardElement) {
      this.cardElement.unmount();
      this.cardMounted = false;
      this.cardElement = null;
    }
  }

  ngOnDestroy() {
    if (this.cardElement) {
      this.cardElement.unmount();
    }
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  }

  async handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!this.cardElement || !this.selectedProduct?.default_price) {
      this.errorMessage = 'Payment form is not ready';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const paymentMethod = await this.stripeService.createPaymentMethod(this.cardElement);
      
      const response = await this.http.post<any>('http://localhost:3000/api/create-payment-intent', {
        amount: this.selectedProduct.default_price.unit_amount,
        paymentMethodId: paymentMethod.id,
        productId: this.selectedProduct.id
      }).toPromise();
      
      if (response.success) {
        this.successMessage = 'Payment successful! Thank you for your purchase.';
        this.cardElement.clear();
        setTimeout(() => {
          this.closeCheckout();
        }, 2000);
      } else {
        this.errorMessage = response.error || 'Payment failed';
      }
    } catch (error: any) {
      this.errorMessage = error.message || 'An error occurred processing your payment';
      console.error('Payment error:', error);
    } finally {
      this.loading = false;
    }
  }
}
