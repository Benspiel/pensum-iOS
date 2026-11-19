Pod::Spec.new do |s|
  s.name           = 'PensumDocuments'
  s.version        = '0.1.0'
  s.summary        = 'Local PDF rendering and worksheet export for Pensum'
  s.description    = 'Renders selected PDF pages and exports annotated worksheets on iOS.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Pensum'
  s.homepage       = 'https://pensum-omega.vercel.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks      = 'UIKit', 'CoreGraphics'
  s.source_files    = '**/*.swift'
end
