import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#444',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    borderBottom: '1pt solid #333',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    width: 130,
  },
  value: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    color: '#fff',
    padding: 5,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 5,
    fontSize: 8,
    borderBottom: '0.5pt solid #ddd',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 5,
    fontSize: 8,
    borderBottom: '0.5pt solid #ddd',
    backgroundColor: '#f9f9f9',
  },
  colNum: { width: '5%' },
  colDate: { width: '15%' },
  colAction: { width: '14%' },
  colOfficer: { width: '18%' },
  colFrom: { width: '14%' },
  colTo: { width: '14%' },
  colSig: { width: '20%' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#888',
    textAlign: 'center',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 6,
  },
});

export interface CustodyCertificateData {
  evidenceId: string;
  qrCode: string;
  type: string;
  description: string;
  status: string;
  isSealed: boolean;
  collectedBy: string;
  collectedDate: string;
  station: string;
  events: Array<{
    action: string;
    officerName: string;
    officerBadge: string;
    fromLocation: string | null;
    toLocation: string | null;
    signature: string;
    createdAt: string;
  }>;
  generatedAt: string;
  generatedBy: string;
}

export function ChainOfCustodyCertificate({ data }: { data: CustodyCertificateData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>CHAIN OF CUSTODY CERTIFICATE</Text>
          <Text style={styles.subtitle}>Criminal Record Management System (OpenJustice)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidence Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Evidence ID:</Text>
            <Text style={styles.value}>{data.evidenceId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>QR Code:</Text>
            <Text style={styles.value}>{data.qrCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Type:</Text>
            <Text style={styles.value}>{data.type}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Description:</Text>
            <Text style={styles.value}>{data.description || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{data.status.toUpperCase()}{data.isSealed ? ' (SEALED)' : ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collected By:</Text>
            <Text style={styles.value}>{data.collectedBy}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Collection Date:</Text>
            <Text style={styles.value}>{data.collectedDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Station:</Text>
            <Text style={styles.value}>{data.station}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custody Events ({data.events.length})</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colNum}>#</Text>
            <Text style={styles.colDate}>Date/Time</Text>
            <Text style={styles.colAction}>Action</Text>
            <Text style={styles.colOfficer}>Officer</Text>
            <Text style={styles.colFrom}>From</Text>
            <Text style={styles.colTo}>To</Text>
            <Text style={styles.colSig}>Signature (SHA-256)</Text>
          </View>
          {data.events.map((event, idx) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colNum}>{idx + 1}</Text>
              <Text style={styles.colDate}>{event.createdAt}</Text>
              <Text style={styles.colAction}>{event.action}</Text>
              <Text style={styles.colOfficer}>{event.officerName} ({event.officerBadge})</Text>
              <Text style={styles.colFrom}>{event.fromLocation || '-'}</Text>
              <Text style={styles.colTo}>{event.toLocation || '-'}</Text>
              <Text style={styles.colSig}>{event.signature.substring(0, 16)}...</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>Generated: {data.generatedAt} | By: {data.generatedBy} | This document is system-generated and cryptographically verifiable.</Text>
        </View>
      </Page>
    </Document>
  );
}
