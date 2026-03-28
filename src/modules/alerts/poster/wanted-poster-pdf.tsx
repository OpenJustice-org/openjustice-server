/**
 * Wanted Person Poster PDF Template
 *
 * Generates a professional PDF poster for wanted persons
 * Designed for printing and official distribution
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { WantedPosterData, PosterBranding } from './poster.types';
import { generateBulletinNumber, truncateText } from './poster.config';
import { baseStyles, wantedStyles, getDangerBadgeStyle } from './poster-styles';

interface WantedPosterPDFProps {
  data: WantedPosterData;
  branding: PosterBranding;
}

export function WantedPosterPDF({ data, branding }: WantedPosterPDFProps) {
  const bulletinNumber = generateBulletinNumber(data.id, 'wanted');
  const dangerBadgeStyle = getDangerBadgeStyle(data.dangerLevel);

  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        {/* Header */}
        <View style={baseStyles.header}>
          <View style={baseStyles.headerLeft}>
            {branding.logoUrl && (
              <Image src={branding.logoUrl} style={baseStyles.logo} />
            )}
            <View>
              <Text style={baseStyles.orgName}>{branding.organizationName}</Text>
              <Text style={baseStyles.bulletinNumber}>
                Bulletin No. {bulletinNumber}
              </Text>
            </View>
          </View>
          <View style={baseStyles.badgeContainer}>
            <View style={dangerBadgeStyle}>
              <Text>{data.dangerLevelDisplay}</Text>
            </View>
          </View>
        </View>

        {/* Main Banner */}
        <View style={wantedStyles.banner}>
          <Text style={wantedStyles.bannerText}>WANTED</Text>
        </View>

        {/* Content Row - Photo and Details */}
        <View style={baseStyles.contentRow}>
          <View style={baseStyles.photoContainer}>
            {data.photoUrl ? (
              <Image src={data.photoUrl} style={baseStyles.photo} />
            ) : (
              <Text style={baseStyles.photoPlaceholder}>
                NO PHOTO{'\n'}AVAILABLE
              </Text>
            )}
          </View>

          <View style={baseStyles.detailsPanel}>
            <View style={baseStyles.detailRow}>
              <Text style={wantedStyles.detailLabel}>NAME</Text>
              <Text style={wantedStyles.detailValue}>
                {truncateText(data.name, 40)}
              </Text>
            </View>

            <View style={baseStyles.detailRow}>
              <Text style={wantedStyles.detailLabel}>LAST SEEN</Text>
              <Text style={wantedStyles.detailValue}>
                {data.lastSeenLocation || 'Unknown Location'}
                {data.lastSeenDate && `\n${data.lastSeenDate}`}
              </Text>
            </View>

            <View style={baseStyles.detailRow}>
              <Text style={wantedStyles.detailLabel}>CLASSIFICATION</Text>
              <Text style={wantedStyles.detailValue}>
                {data.dangerLevelDisplay}
              </Text>
            </View>

            <View style={baseStyles.detailRow}>
              <Text style={wantedStyles.detailLabel}>POINT OF CONTACT</Text>
              <Text style={wantedStyles.detailValue}>
                {branding.organizationName}
                {'\n'}
                {data.contactPhone}
              </Text>
            </View>
          </View>
        </View>

        {/* Charges Section */}
        <View style={baseStyles.chargesSection}>
          <Text style={baseStyles.chargesTitle}>CHARGES</Text>
          <Text style={baseStyles.chargesText}>
            {data.charges.length > 0
              ? data.charges.join(' | ')
              : 'Charges pending'}
          </Text>
        </View>

        {/* Physical Description */}
        {data.physicalDescription && (
          <View style={baseStyles.chargesSection}>
            <Text style={baseStyles.chargesTitle}>PHYSICAL DESCRIPTION</Text>
            <Text style={baseStyles.chargesText}>
              {truncateText(data.physicalDescription, 200)}
            </Text>
          </View>
        )}

        {/* Public Advisory */}
        <View style={wantedStyles.advisorySection}>
          <Text style={baseStyles.advisoryTitle}>PUBLIC ADVISORY</Text>
          <Text style={baseStyles.advisoryText}>{data.publicAdvisory}</Text>
        </View>

        {/* How to Help */}
        <View style={wantedStyles.helpSection}>
          <Text style={baseStyles.helpTitle}>HOW TO HELP</Text>
          <Text style={baseStyles.helpText}>
            If you have any information, please contact:
          </Text>
          <Text style={baseStyles.contactNumber}>
            {branding.hotline} | {data.contactPhone}
          </Text>
          {data.rewardDisplay && (
            <Text style={baseStyles.rewardText}>{data.rewardDisplay}</Text>
          )}
        </View>

        {/* Warrant Info */}
        <View style={styles.warrantInfo}>
          <Text style={styles.warrantText}>
            Warrant No: {data.warrantNumber} | Issued: {data.issuedDate}
            {data.isRegionalAlert && ' | REGIONAL ALERT'}
          </Text>
        </View>

        {/* Footer */}
        <Text style={baseStyles.footer}>
          {branding.organizationName}
          {branding.website && ` | ${branding.website}`}
          {'\n'}
          Generated by OpenJustice - Criminal Record Management System
        </Text>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  warrantInfo: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
  },
  warrantText: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default WantedPosterPDF;
