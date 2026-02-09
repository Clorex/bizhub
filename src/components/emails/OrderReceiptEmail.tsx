import * as React from "react";
import { Html, Head, Preview, Body, Container, Section, Heading, Text, Row, Column, Img } from "@react-email/components";

// Helper to format currency
function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

interface OrderReceiptEmailProps {
  orderId: string;
  orderDate: string;
  storeName: string;
  customerName: string;
  customerEmail: string;
  items: { name: string; qty: number; price: number; selectedOptions?: Record<string, string> }[];
  pricing: {
    originalSubtotalKobo: number;
    saleDiscountKobo: number;
    couponDiscountKobo: number;
    shippingFeeKobo: number;
    totalKobo: number;
  };
}

export const OrderReceiptEmail: React.FC<Readonly<OrderReceiptEmailProps>> = ({
  orderId,
  orderDate,
  storeName,
  customerName,
  items,
  pricing,
}) => (
  <Html>
    <Head />
    <Preview>Your {storeName} Order Receipt #{orderId.slice(0, 8)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={heading}>Thank you for your order!</Heading>
          <Text style={subheading}>
            Here is your receipt for order #{orderId.slice(0, 8)} from {storeName}.
          </Text>
        </Section>

        <Section style={box}>
          <Row>
            <Column>
              <Text style={label}>Order ID</Text>
              <Text style={value}>{orderId}</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={label}>Order Date</Text>
              <Text style={value}>{orderDate}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={box}>
          <Heading as="h2" style={sectionHeading}>
            Items
          </Heading>
          {items.map((item, idx) => (
            <Row key={idx} style={itemRow}>
              <Column>
                <Text style={itemText}>
                  {item.qty} x {item.name}
                </Text>
                {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                  <Text style={itemOptions}>
                    {Object.entries(item.selectedOptions)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </Text>
                )}
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={itemText}>{fmtNaira(item.price * item.qty)}</Text>
              </Column>
            </Row>
          ))}
        </Section>

        <Section style={box}>
          <Heading as="h2" style={sectionHeading}>
            Summary
          </Heading>
          <Row style={summaryRow}>
            <Column>
              <Text style={summaryLabel}>Subtotal</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={summaryValue}>{fmtNaira(pricing.originalSubtotalKobo / 100)}</Text>
            </Column>
          </Row>
          {pricing.saleDiscountKobo > 0 && (
            <Row style={summaryRow}>
              <Column>
                <Text style={summaryLabel}>Sale Discount</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={summaryValue}>-{fmtNaira(pricing.saleDiscountKobo / 100)}</Text>
              </Column>
            </Row>
          )}
          {pricing.couponDiscountKobo > 0 && (
            <Row style={summaryRow}>
              <Column>
                <Text style={summaryLabel}>Coupon Discount</Text>
              </Column>
              <Column style={{ textAlign: "right" }}>
                <Text style={summaryValue}>-{fmtNaira(pricing.couponDiscountKobo / 100)}</Text>
              </Column>
            </Row>
          )}
          <Row style={summaryRow}>
            <Column>
              <Text style={summaryLabel}>Shipping</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={summaryValue}>{fmtNaira(pricing.shippingFeeKobo / 100)}</Text>
            </Column>
          </Row>
          <hr style={hr} />
          <Row style={summaryRow}>
            <Column>
              <Text style={totalLabel}>Total Paid</Text>
            </Column>
            <Column style={{ textAlign: "right" }}>
              <Text style={totalValue}>{fmtNaira(pricing.totalKobo / 100)}</Text>
            </Column>
          </Row>
        </Section>
        <Text style={footer}>
          myBizHub • If you have any questions, please contact the vendor directly.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default OrderReceiptEmail;

// Styles
const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "20px 0 48px", width: "580px" };
const header = { padding: "0 48px", textAlign: "center" as const };
const heading = { color: "#1a1a1a", fontSize: "28px", fontWeight: "bold" };
const subheading = { color: "#555", fontSize: "16px" };
const box = { padding: "24px 48px", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", margin: "20px 0" };
const sectionHeading = { color: "#1a1a1a", fontSize: "18px", fontWeight: "bold", margin: "0 0 16px" };
const label = { color: "#888", fontSize: "12px", textTransform: "uppercase" as const };
const value = { color: "#333", fontSize: "14px", fontWeight: "bold" };
const itemRow = { marginBottom: "12px" };
const itemText = { color: "#333", fontSize: "14px", margin: 0 };
const itemOptions = { color: "#777", fontSize: "12px", margin: "4px 0 0" };
const summaryRow = { marginBottom: "8px" };
const summaryLabel = { color: "#555", fontSize: "14px", margin: 0 };
const summaryValue = { color: "#333", fontSize: "14px", margin: 0 };
const hr = { borderColor: "#e5e7eb", margin: "16px 0" };
const totalLabel = { color: "#1a1a1a", fontSize: "16px", fontWeight: "bold", margin: 0 };
const totalValue = { color: "#1a1a1a", fontSize: "16px", fontWeight: "bold", margin: 0 };
const footer = { color: "#888888", fontSize: "12px", textAlign: "center" as const, marginTop: "20px" };