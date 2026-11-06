-- Migration: Remove WhatsApp Integration Table
-- Completely remove WhatsApp settings table and associated references

DROP TABLE IF EXISTS public.agency_whatsapp_settings CASCADE;
